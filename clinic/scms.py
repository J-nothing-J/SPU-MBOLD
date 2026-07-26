from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import requests
from django.conf import settings


class SCMSAPIError(Exception):
    def __init__(self, message: str, *, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


class SCMSNotFoundError(SCMSAPIError):
    def __init__(self, message: str = 'SCMS profile not found.'):
        super().__init__(message, status_code=404)


class SCMSClient:
    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        api_secret: str,
        timeout: float,
        session: requests.Session | None = None,
    ):
        self.base_url = (base_url or '').rstrip('/')
        self.api_key = api_key
        self.api_secret = api_secret
        self.timeout = timeout
        self.session = session or requests.Session()

        self._token: str | None = None
        self._token_expires_at: datetime | None = None

    def _is_token_valid(self) -> bool:
        return bool(
            self._token
            and self._token_expires_at
            and datetime.now(timezone.utc) < self._token_expires_at
        )

    def _read_json(self, response: requests.Response) -> dict[str, Any]:
        try:
            payload = response.json()
        except ValueError as exc:
            raise SCMSAPIError('SCMS returned an invalid JSON response.', status_code=502) from exc
        if not isinstance(payload, dict):
            raise SCMSAPIError('SCMS response payload has an invalid format.', status_code=502)
        return payload

    def _login(self) -> None:
        if not self.api_key or not self.api_secret:
            raise SCMSAPIError('SCMS credentials are not configured.', status_code=503)

        try:
            response = self.session.post(
                f'{self.base_url}/auth/login',
                data={
                    'api_key': self.api_key,
                    'api_secret': self.api_secret,
                },
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            raise SCMSAPIError('Unable to reach SCMS authentication endpoint.', status_code=502) from exc

        if response.status_code != 200:
            if response.status_code in (400, 401, 403):
                raise SCMSAPIError('SCMS authentication failed.', status_code=503)
            if response.status_code == 429:
                raise SCMSAPIError('SCMS authentication rate limit reached.', status_code=429)
            raise SCMSAPIError('SCMS authentication service is unavailable.', status_code=502)

        payload = self._read_json(response)
        token = str(payload.get('token') or '').strip()
        if not token:
            raise SCMSAPIError('SCMS authentication did not return a token.', status_code=502)

        expires_minutes_raw = payload.get('expires_in_minutes')
        try:
            expires_minutes = int(expires_minutes_raw)
        except (TypeError, ValueError):
            expires_minutes = 5

        # Refresh a bit early so request bursts do not race the expiration boundary.
        safe_minutes = max(expires_minutes - 1, 1)
        self._token = token
        self._token_expires_at = datetime.now(timezone.utc) + timedelta(minutes=safe_minutes)

    def _authorized_get(self, path: str) -> requests.Response:
        for attempt in range(2):
            if not self._is_token_valid():
                self._login()

            headers = {
                'Authorization': f'Bearer {self._token}',
            }
            try:
                response = self.session.get(
                    f'{self.base_url}{path}',
                    headers=headers,
                    params={'lang': 'th'},
                    timeout=self.timeout,
                )
            except requests.RequestException as exc:
                raise SCMSAPIError('Unable to reach SCMS profile endpoint.', status_code=502) from exc

            if response.status_code == 401 and attempt == 0:
                self._token = None
                self._token_expires_at = None
                continue

            return response

        raise SCMSAPIError('SCMS authentication failed after retry.', status_code=502)

    def _request_profile(self, path: str) -> dict[str, Any]:
        response = self._authorized_get(path)

        if response.status_code == 404:
            raise SCMSNotFoundError()
        if response.status_code == 403:
            raise SCMSAPIError('SCMS access forbidden for this integration.', status_code=403)
        if response.status_code == 429:
            raise SCMSAPIError('SCMS request rate limit reached.', status_code=429)
        if response.status_code == 401:
            raise SCMSAPIError('SCMS token was rejected.', status_code=503)
        if response.status_code != 200:
            if 400 <= response.status_code < 500:
                raise SCMSAPIError('SCMS rejected the profile request.', status_code=502)
            raise SCMSAPIError('SCMS profile service is unavailable.', status_code=502)

        payload = self._read_json(response)
        data = payload.get('data')
        if not isinstance(data, dict):
            raise SCMSAPIError('SCMS profile payload is missing data.', status_code=502)

        return data

    def get_student_profile(self, student_id: str) -> dict[str, str]:
        data = self._request_profile(f'/student/{student_id}')
        return _normalize_profile(data)

    def get_staff_profile(self, employee_id: str) -> dict[str, str]:
        data = self._request_profile(f'/staff/{employee_id}')
        return _normalize_profile(data)


def _normalize_gender(value: Any) -> str:
    normalized = str(value or '').strip().lower()
    if normalized in {'male', 'm', 'ชาย'}:
        return 'male'
    if normalized in {'female', 'f', 'หญิง'}:
        return 'female'
    return 'other'


def _normalize_profile(data: dict[str, Any]) -> dict[str, str]:
    name = str(data.get('std_name') or data.get('emp_name') or data.get('name') or '').strip()
    organization = str(
        data.get('division_name') or data.get('organization') or ''
    ).strip()

    return {
        'name': name,
        'organization': organization,
        'gender': _normalize_gender(data.get('gender_name') or data.get('gender')),
        'source': 'scms',
    }


_scms_client: SCMSClient | None = None


def get_scms_client() -> SCMSClient:
    global _scms_client

    if _scms_client is None:
        _scms_client = SCMSClient(
            base_url=settings.SCMS_API_BASE_URL,
            api_key=settings.SCMS_API_KEY,
            api_secret=settings.SCMS_API_SECRET,
            timeout=settings.SCMS_API_TIMEOUT,
        )

    return _scms_client


def fetch_scms_profile(*, student_id: str, id_type: str) -> dict[str, str]:
    client = get_scms_client()

    if id_type == 'student':
        return client.get_student_profile(student_id)
    if id_type == 'employee':
        return client.get_staff_profile(student_id)

    raise SCMSAPIError('Unsupported id_type.', status_code=400)

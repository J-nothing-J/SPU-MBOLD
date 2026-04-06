from django.conf import settings


def clarity_settings(request):
    return {
        'clarity_enabled': bool(getattr(settings, 'CLARITY_ENABLED', False)),
        'clarity_project_id': (getattr(settings, 'CLARITY_PROJECT_ID', '') or '').strip(),
    }
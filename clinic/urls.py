from django.urls import path

from . import views

urlpatterns = [
    path('', views.root_redirect, name='root'),
    path('login/', views.login_view, name='login'),
    path('login/nurse/', views.nurse_login_view, name='nurse_login'),
    path('login/admin/', views.admin_login_view, name='admin_login'),
    path('logout/', views.logout_view, name='logout'),
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('new-case/', views.new_case_view, name='new_case'),
    path('cases/', views.cases_view, name='cases'),
    path('cases/<str:case_id>/edit/', views.case_edit_view, name='case_edit'),
    path('patients/', views.patients_view, name='patients'),
    path('patients/<str:student_id>/edit/', views.patient_edit_view, name='patient_edit'),
    path('inventory/', views.inventory_view, name='inventory'),
    path('beds/', views.beds_view, name='beds'),
    path('users/', views.user_management_view, name='user_management'),
    path('api/patients/<str:student_id>/', views.api_get_patient, name='api_get_patient'),
    path('audit-logs/', views.audit_logs_view, name='audit_logs'),
]

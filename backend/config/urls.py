from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("apps.proxy.urls")),
    path("api/v1/accounts/", include("apps.accounts.urls")),
    path("api/v1/plans/", include("apps.plans.urls")),
]

from django.urls import path

from . import views

app_name = "proxy"

urlpatterns = [
    path("overpass/", views.OverpassProxyView.as_view(), name="overpass"),
    path("climate/", views.ClimateProxyView.as_view(), name="climate"),
    path("canopy/<str:quadkey>/", views.CanopyTileView.as_view(), name="canopy"),
    path("health/", views.health_check, name="health"),
]

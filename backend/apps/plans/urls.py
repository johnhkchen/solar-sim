from django.urls import path

from . import views

app_name = "plans"

urlpatterns = [
    path("", views.PlanListCreateView.as_view(), name="list-create"),
    path("<int:pk>/", views.PlanDetailView.as_view(), name="detail"),
    path("<int:pk>/archive/", views.PlanArchiveView.as_view(), name="archive"),
]

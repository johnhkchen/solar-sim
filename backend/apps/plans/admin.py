from django.contrib import admin

from .models import Plan, PlanExport


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "address", "archived", "updated_at")
    list_filter = ("archived", "created_at")
    search_fields = ("name", "address", "user__username")
    readonly_fields = ("created_at", "updated_at")


@admin.register(PlanExport)
class PlanExportAdmin(admin.ModelAdmin):
    list_display = ("plan", "created_at")
    list_filter = ("created_at",)

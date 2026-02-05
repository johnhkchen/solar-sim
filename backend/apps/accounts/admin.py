from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "email", "tier", "is_staff", "date_joined")
    list_filter = ("tier", "is_staff", "is_active")
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Subscription", {"fields": ("tier", "stripe_customer_id", "stripe_subscription_id")}),
    )

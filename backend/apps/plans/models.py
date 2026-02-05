from django.conf import settings
from django.db import models


class Plan(models.Model):
    """
    A saved planting plan for a specific location.

    Contains the location, zones, selected plants, and metadata needed to
    generate the PDF export.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="plans",
    )
    name = models.CharField(max_length=255)

    # Location
    latitude = models.FloatField()
    longitude = models.FloatField()
    address = models.TextField(blank=True)
    timezone = models.CharField(max_length=64, default="UTC")

    # Plan data stored as JSON
    # Contains: zones, trees, selected plants, preferences
    data = models.JSONField(default=dict)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    archived = models.BooleanField(default=False)

    class Meta:
        db_table = "plans"
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.name} ({self.user.username})"


class PlanExport(models.Model):
    """
    Record of PDF exports for a plan.

    Tracks export history and stores the generated PDF for re-download.
    """

    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, related_name="exports")
    created_at = models.DateTimeField(auto_now_add=True)

    # PDF stored as binary or path to file storage
    pdf_file = models.FileField(upload_to="exports/", blank=True)

    class Meta:
        db_table = "plan_exports"
        ordering = ["-created_at"]

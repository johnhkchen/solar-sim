from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom user model for Solar-Sim.

    Extends Django's AbstractUser to add subscription-related fields.
    """

    # Subscription tier: free, pay_per_plan, pro
    TIER_FREE = "free"
    TIER_PAY_PER_PLAN = "pay_per_plan"
    TIER_PRO = "pro"
    TIER_CHOICES = [
        (TIER_FREE, "Free"),
        (TIER_PAY_PER_PLAN, "Pay per Plan"),
        (TIER_PRO, "Pro"),
    ]

    tier = models.CharField(max_length=20, choices=TIER_CHOICES, default=TIER_FREE)
    stripe_customer_id = models.CharField(max_length=255, blank=True)
    stripe_subscription_id = models.CharField(max_length=255, blank=True)

    # Plan limits
    MAX_FREE_PLANS = 4
    MAX_PRO_PLANS = 75

    @property
    def plan_limit(self) -> int | None:
        """Returns the maximum number of plans for this user's tier."""
        if self.tier == self.TIER_FREE:
            return self.MAX_FREE_PLANS
        elif self.tier == self.TIER_PRO:
            return self.MAX_PRO_PLANS
        else:
            # Pay-per-plan has no hard limit
            return None

    @property
    def can_create_plan(self) -> bool:
        """Check if user can create another plan."""
        limit = self.plan_limit
        if limit is None:
            return True
        return self.plans.filter(archived=False).count() < limit

    class Meta:
        db_table = "users"

from rest_framework import generics, serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Plan


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = [
            "id",
            "name",
            "latitude",
            "longitude",
            "address",
            "timezone",
            "data",
            "archived",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class PlanListCreateView(generics.ListCreateAPIView):
    """List user's plans or create a new one."""

    serializer_class = PlanSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Plan.objects.filter(user=self.request.user, archived=False)

    def perform_create(self, serializer):
        # Check plan limit
        if not self.request.user.can_create_plan:
            raise serializers.ValidationError(
                {"detail": "Plan limit reached. Upgrade your subscription to create more plans."}
            )
        serializer.save(user=self.request.user)


class PlanDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or delete a specific plan."""

    serializer_class = PlanSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Plan.objects.filter(user=self.request.user)


class PlanArchiveView(APIView):
    """Archive a plan (soft delete)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            plan = Plan.objects.get(pk=pk, user=request.user)
        except Plan.DoesNotExist:
            return Response(
                {"detail": "Plan not found"}, status=status.HTTP_404_NOT_FOUND
            )

        plan.archived = True
        plan.save()
        return Response({"detail": "Plan archived"})

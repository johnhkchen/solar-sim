from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User


class UserSerializer(serializers.ModelSerializer):
    plan_count = serializers.SerializerMethodField()
    plan_limit = serializers.IntegerField(read_only=True)
    can_create_plan = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "tier",
            "plan_count",
            "plan_limit",
            "can_create_plan",
        ]
        read_only_fields = ["id", "tier"]

    def get_plan_count(self, obj):
        return obj.plans.filter(archived=False).count()


class CurrentUserView(APIView):
    """Get the current authenticated user's profile."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import UserStats


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_stats(sender, instance, created, **kwargs):
    """
    Ensure every runner account has a corresponding UserStats record initialized.
    """
    if created:
        UserStats.objects.get_or_create(user=instance)

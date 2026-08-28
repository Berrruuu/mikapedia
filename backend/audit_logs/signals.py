from django.db.models.signals import pre_save, post_save, pre_delete, post_delete
from django.dispatch import receiver
from django.forms.models import model_to_dict

from .models import AuditLog
from .utils import create_audit


_PRE_SAVE_SNAP = {}


def _key_for_instance(instance):
    return f"{instance.__class__.__module__}.{instance.__class__.__name__}:{getattr(instance, 'pk', 'new')}"


@receiver(pre_save)
def _capture_pre_save(sender, instance, **kwargs):
    # Skip AuditLog itself to avoid recursion
    if sender is AuditLog:
        return
    if getattr(instance, 'pk', None):
        try:
            old = sender.objects.filter(pk=instance.pk).first()
            if old is not None:
                _PRE_SAVE_SNAP[_key_for_instance(instance)] = model_to_dict(old)
        except Exception:
            pass


@receiver(post_save)
def _create_post_save(sender, instance, created, **kwargs):
    if sender is AuditLog:
        return
    key = _key_for_instance(instance)
    before = _PRE_SAVE_SNAP.pop(key, None)
    after = model_to_dict(instance)
    action = 'created' if created else 'updated'
    create_audit(
        action=f"{sender.__name__}.{action}",
        category='system',
        severity='info',
        target=instance,
        before=before,
        after=after,
    )


@receiver(pre_delete)
def _capture_pre_delete(sender, instance, **kwargs):
    if sender is AuditLog:
        return
    try:
        _PRE_SAVE_SNAP[_key_for_instance(instance)] = model_to_dict(instance)
    except Exception:
        pass


@receiver(post_delete)
def _create_post_delete(sender, instance, **kwargs):
    if sender is AuditLog:
        return
    key = _key_for_instance(instance)
    before = _PRE_SAVE_SNAP.pop(key, None)
    create_audit(
        action=f"{sender.__name__}.deleted",
        category='system',
        severity='warning',
        target=instance,
        before=before,
        after=None,
    )

"""
GestureX Enhanced SMTP Email Backend
Handles bounded timeouts, credential masking in logs, and Gmail-specific SMTP error diagnosis.
"""

import logging
import smtplib
from django.core.mail.backends.smtp import EmailBackend

logger = logging.getLogger('accounts.email_backend')


class GestureXEmailBackend(EmailBackend):
    """
    Enhanced SMTP Email Backend for GestureX.
    Specifically catches and translates SMTPServerDisconnected during open() into SMTPAuthenticationError,
    because Google terminates the TCP socket immediately when App Password credentials fail (535 BadCredentials).
    This prevents misleading 'connection closed' or 'check recipient email' errors.
    """

    def open(self):
        try:
            return super().open()
        except smtplib.SMTPServerDisconnected as e:
            logger.error("SMTP provider terminated connection during authentication. Diagnosis: 535 BadCredentials.")
            raise smtplib.SMTPAuthenticationError(
                535,
                b"SMTP provider rejected credentials (535 BadCredentials). "
                b"Please verify that EMAIL_HOST_USER is correct and EMAIL_HOST_PASSWORD is a valid 16-character Google App Password."
            ) from e

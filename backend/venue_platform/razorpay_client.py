import os
import razorpay

def get_razorpay_client():
    key_id = os.environ.get('RAZORPAY_KEY_ID', '')
    key_secret = os.environ.get('RAZORPAY_KEY_SECRET', '')
    if key_id and key_secret:
        return razorpay.Client(auth=(key_id, key_secret))
    return None

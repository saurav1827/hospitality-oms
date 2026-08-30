import os
import django
import sys

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from venue_platform.models import Property, MenuItem

def seed_menu():
    from django.contrib.auth import get_user_model
    from venue_platform.models import PropertyMembership
    User = get_user_model()
    user = User.objects.filter(username='hotel_ramayan').first()
    if not user:
        print("User 'hotel_ramayan' not found!")
        return
        
    membership = PropertyMembership.objects.filter(user=user).first()
    if not membership:
        print("User 'hotel_ramayan' does not belong to any property!")
        return
        
    prop = membership.property
    print(f"Seeding menu for {prop.name} (ID: {prop.id})...")

    # Clear existing menu items to prevent duplicates during testing
    MenuItem.objects.filter(property=prop).delete()

    images = {
        'samosa': "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&q=80&w=800",
        'tikka': "https://images.unsplash.com/photo-1599487405902-6c17242d5ef8?auto=format&fit=crop&q=80&w=800",
        'kebab': "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&q=80&w=800",
        'red_curry': 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&q=80&w=800',
        'yellow_curry': "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&q=80&w=800",
        'dry_veg': "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&q=80&w=800",
        'biryani': "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=800",
        'rice': "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&q=80&w=800",
        'bread': "https://images.unsplash.com/photo-1626074961596-caa8b7a0d4c1?auto=format&fit=crop&q=80&w=800",
        'dosa': "https://images.unsplash.com/photo-1589301760014-d929f39ce9b1?auto=format&fit=crop&q=80&w=800",
        'chinese': "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&q=80&w=800",
        'chaat': "https://images.unsplash.com/photo-1601050690151-54bc5e3e4b39?auto=format&fit=crop&q=80&w=800",
        'thali': "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&q=80&w=800",
        'sweets': "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&q=80&w=800",
        'beverage': "https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?auto=format&fit=crop&q=80&w=800",
    }

    def get_img(name, cat):
        n = name.lower()
        if 'samosa' in n: return images['samosa']
        if 'tikka' in n: return images['tikka']
        if 'kebab' in n: return images['kebab']
        if 'butter chicken' in n or 'chicken' in n and 'curry' in n or 'masala' in n and 'chicken' in n or 'mutton' in n or 'fish' in n: return images['red_curry']
        if 'dal' in n or 'paneer' in n and ('masala' in n or 'kadhai' in n or 'shahi' in n): return images['yellow_curry']
        if 'aloo' in n or 'mix veg' in n or 'bhaji' in n: return images['dry_veg']
        if 'biryani' in n: return images['biryani']
        if 'rice' in n or 'pulao' in n: return images['rice']
        if 'roti' in n or 'naan' in n or 'paratha' in n or 'kulcha' in n: return images['bread']
        if 'dosa' in n or 'idli' in n or 'vada' in n or 'uttapam' in n: return images['dosa']
        if 'noodle' in n or 'fried rice' in n or 'chilli' in n or 'manchurian' in n: return images['chinese']
        if 'puri' in n or 'tikki' in n or 'chaat' in n or 'bhature' in n: return images['chaat']
        if 'thali' in n: return images['thali']
        if cat == 'Desserts': return images['sweets']
        if cat == 'Beverages': return images['beverage']
        return images['yellow_curry'] # default fallback

    menu_data_raw = [
        # 1. Starters
        ("Samosa", "Starters", "Veg Starters", "veg", 60),
        ("Paneer Tikka", "Starters", "Veg Starters", "veg", 220),
        ("Hara Bhara Kebab", "Starters", "Veg Starters", "veg", 180),
        ("Veg Seekh Kebab", "Starters", "Veg Starters", "veg", 190),
        ("Chicken Tikka", "Starters", "Non-Veg Starters", "non_veg", 280),
        ("Chicken Seekh Kebab", "Starters", "Non-Veg Starters", "non_veg", 260),
        ("Tandoori Chicken", "Starters", "Non-Veg Starters", "non_veg", 320),
        ("Fish Tikka", "Starters", "Non-Veg Starters", "non_veg", 350),
        
        # 2. North Indian — Veg
        ("Paneer Butter Masala", "Main Course", "North Indian - Veg", "veg", 240),
        ("Kadhai Paneer", "Main Course", "North Indian - Veg", "veg", 230),
        ("Shahi Paneer", "Main Course", "North Indian - Veg", "veg", 240),
        ("Palak Paneer", "Main Course", "North Indian - Veg", "veg", 220),
        ("Paneer Lababdar", "Main Course", "North Indian - Veg", "veg", 250),
        ("Matar Paneer", "Main Course", "North Indian - Veg", "veg", 210),
        ("Dal Makhani", "Main Course", "North Indian - Veg", "veg", 190),
        ("Dal Tadka", "Main Course", "North Indian - Veg", "veg", 170),
        ("Chana Masala", "Main Course", "North Indian - Veg", "veg", 170),
        ("Malai Kofta", "Main Course", "North Indian - Veg", "veg", 230),
        ("Mix Veg", "Main Course", "North Indian - Veg", "veg", 190),
        ("Aloo Gobhi", "Main Course", "North Indian - Veg", "veg", 180),
        
        # 3. North Indian — Non-Veg
        ("Butter Chicken", "Main Course", "North Indian - Non-Veg", "non_veg", 290),
        ("Chicken Tikka Masala", "Main Course", "North Indian - Non-Veg", "non_veg", 300),
        ("Kadhai Chicken", "Main Course", "North Indian - Non-Veg", "non_veg", 290),
        ("Chicken Curry", "Main Course", "North Indian - Non-Veg", "non_veg", 270),
        ("Chicken Handi", "Main Course", "North Indian - Non-Veg", "non_veg", 310),
        ("Mutton Rogan Josh", "Main Course", "North Indian - Non-Veg", "non_veg", 360),
        ("Mutton Curry", "Main Course", "North Indian - Non-Veg", "non_veg", 350),
        ("Fish Curry", "Main Course", "North Indian - Non-Veg", "non_veg", 320),
        ("Chicken Do Pyaza", "Main Course", "North Indian - Non-Veg", "non_veg", 290),
        
        # 4. Biryani & Rice
        ("Veg Biryani", "Biryani & Rice", "Biryani", "veg", 220),
        ("Paneer Biryani", "Biryani & Rice", "Biryani", "veg", 250),
        ("Chicken Biryani", "Biryani & Rice", "Biryani", "non_veg", 280),
        ("Mutton Biryani", "Biryani & Rice", "Biryani", "non_veg", 350),
        ("Hyderabadi Chicken Biryani", "Biryani & Rice", "Biryani", "non_veg", 300),
        ("Jeera Rice", "Biryani & Rice", "Rice", "veg", 140),
        ("Veg Pulao", "Biryani & Rice", "Rice", "veg", 170),
        ("Steamed Rice", "Biryani & Rice", "Rice", "veg", 120),
        ("Curd Rice", "Biryani & Rice", "Rice", "veg", 150),
        
        # 5. Indian Breads
        ("Tandoori Roti", "Indian Breads", "Breads", "veg", 30),
        ("Butter Roti", "Indian Breads", "Breads", "veg", 40),
        ("Plain Naan", "Indian Breads", "Breads", "veg", 50),
        ("Butter Naan", "Indian Breads", "Breads", "veg", 60),
        ("Garlic Naan", "Indian Breads", "Breads", "veg", 80),
        ("Cheese Naan", "Indian Breads", "Breads", "veg", 100),
        ("Laccha Paratha", "Indian Breads", "Breads", "veg", 80),
        ("Pudina Paratha", "Indian Breads", "Breads", "veg", 80),
        ("Aloo Paratha", "Indian Breads", "Breads", "veg", 100),
        ("Paneer Paratha", "Indian Breads", "Breads", "veg", 120),
        ("Missi Roti", "Indian Breads", "Breads", "veg", 60),
        ("Amritsari Kulcha", "Indian Breads", "Breads", "veg", 130),
        
        # 6. South Indian
        ("Idli Sambhar", "South Indian", "South Indian", "veg", 100),
        ("Medu Vada", "South Indian", "South Indian", "veg", 110),
        ("Plain Dosa", "South Indian", "South Indian", "veg", 120),
        ("Masala Dosa", "South Indian", "South Indian", "veg", 150),
        ("Mysore Masala Dosa", "South Indian", "South Indian", "veg", 180),
        ("Paneer Dosa", "South Indian", "South Indian", "veg", 200),
        ("Rava Dosa", "South Indian", "South Indian", "veg", 160),
        ("Onion Uttapam", "South Indian", "South Indian", "veg", 150),
        ("Paneer Uttapam", "South Indian", "South Indian", "veg", 190),
        ("Lemon Rice", "South Indian", "South Indian", "veg", 130),
        ("Curd Rice", "South Indian", "South Indian", "veg", 150),
        
        # 7. Chinese / Indo-Chinese
        ("Veg Hakka Noodles", "Indo-Chinese", "Noodles", "veg", 180),
        ("Chicken Hakka Noodles", "Indo-Chinese", "Noodles", "non_veg", 230),
        ("Veg Fried Rice", "Indo-Chinese", "Rice", "veg", 180),
        ("Chicken Fried Rice", "Indo-Chinese", "Rice", "non_veg", 230),
        ("Chilli Paneer", "Indo-Chinese", "Starters", "veg", 220),
        ("Chilli Chicken", "Indo-Chinese", "Starters", "non_veg", 260),
        ("Gobi Manchurian", "Indo-Chinese", "Starters", "veg", 190),
        ("Chicken Manchurian", "Indo-Chinese", "Starters", "non_veg", 250),
        
        # 8. Snacks / Chaat
        ("Pani Puri", "Chaat & Snacks", "Chaat", "veg", 80),
        ("Dahi Puri", "Chaat & Snacks", "Chaat", "veg", 100),
        ("Aloo Tikki", "Chaat & Snacks", "Chaat", "veg", 100),
        ("Papdi Chaat", "Chaat & Snacks", "Chaat", "veg", 110),
        ("Samosa Chaat", "Chaat & Snacks", "Chaat", "veg", 110),
        ("Chole Bhature", "Chaat & Snacks", "Snacks", "veg", 180),
        ("Pav Bhaji", "Chaat & Snacks", "Snacks", "veg", 160),
        ("Vada Pav", "Chaat & Snacks", "Snacks", "veg", 80),
        
        # 9. Thali
        ("Mini Veg Thali", "Thali", "Thali", "veg", 220),
        ("Punjabi Veg Thali", "Thali", "Thali", "veg", 280),
        ("Special Veg Thali", "Thali", "Thali", "veg", 350),
        ("North Indian Thali", "Thali", "Thali", "veg", 320),
        ("South Indian Thali", "Thali", "Thali", "veg", 280),
        ("Non-Veg Thali", "Thali", "Thali", "non_veg", 400),
        ("Special Maharaja Thali", "Thali", "Thali", "non_veg", 500),
        
        # 10. Desserts
        ("Gulab Jamun", "Desserts", "Sweets", "veg", 90),
        ("Rasmalai", "Desserts", "Sweets", "veg", 120),
        ("Rasgulla", "Desserts", "Sweets", "veg", 100),
        ("Kheer", "Desserts", "Sweets", "veg", 100),
        ("Gajar Ka Halwa", "Desserts", "Sweets", "veg", 120),
        ("Kulfi", "Desserts", "Ice Cream", "veg", 100),
        ("Kulfi Faluda", "Desserts", "Ice Cream", "veg", 160),
        ("Jalebi", "Desserts", "Sweets", "veg", 100),
        ("Rabri", "Desserts", "Sweets", "veg", 130),
        ("Ice Cream", "Desserts", "Ice Cream", "veg", 100),
        
        # 11. Beverages
        ("Masala Chai", "Beverages", "Hot Beverages", "veg", 50),
        ("Ginger Tea", "Beverages", "Hot Beverages", "veg", 60),
        ("Filter Coffee", "Beverages", "Hot Beverages", "veg", 80),
        ("Cold Coffee", "Beverages", "Cold Beverages", "veg", 130),
        ("Sweet Lassi", "Beverages", "Cold Beverages", "veg", 100),
        ("Mango Lassi", "Beverages", "Cold Beverages", "veg", 120),
        ("Masala Chaas", "Beverages", "Cold Beverages", "veg", 70),
        ("Fresh Lime Soda", "Beverages", "Cold Beverages", "veg", 90),
        ("Mango Shake", "Beverages", "Cold Beverages", "veg", 130),
        ("Soft Drink", "Beverages", "Cold Beverages", "veg", 60),
        ("Mineral Water", "Beverages", "Water", "veg", 30)
    ]

    for name, category, sub_cat, dietary, price in menu_data_raw:
        MenuItem.objects.create(
            property=prop,
            name=name,
            category=category,
            sub_category=sub_cat,
            dietary_preference=dietary,
            price=price,
            image_url=get_img(name, category),
            is_bestseller=False,
            preparation_time=20 if category != 'Beverages' else 5,
            gst_rate=5.00,
            available=True
        )

    print(f"Successfully seeded {len(menu_data_raw)} menu items for {prop.name}.")

if __name__ == '__main__':
    seed_menu()

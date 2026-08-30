from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import Property, ServiceLocation, MenuItem
from .permissions import IsPropertyManagerOrAdmin, IsPropertyStaff

class PropertyListView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Depending on auth logic, we might want to return only properties the user is a member of.
        # But mirroring the graphql schema exactly:
        properties = Property.objects.filter(active=True)
        data = [{
            'id': str(p.id),
            'name': p.name,
            'currency': p.currency,
            'taxRate': str(p.tax_rate)
        } for p in properties]
        return Response({'properties': data})

class PropertyDetailView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), IsPropertyStaff()]
        return [IsAuthenticated(), IsPropertyManagerOrAdmin()]
    
    def get(self, request, property_id):
        prop = get_object_or_404(Property, id=property_id, active=True)
        return Response({
            'property': {
                'id': str(prop.id),
                'name': prop.name,
                'currency': prop.currency,
                'taxRate': str(prop.tax_rate),
                'timezone': prop.timezone
            }
        })
        
    def patch(self, request, property_id):
        prop = get_object_or_404(Property, id=property_id, active=True)
        
        name = request.data.get('name')
        currency = request.data.get('currency')
        tax_rate = request.data.get('taxRate') if 'taxRate' in request.data else request.data.get('tax_rate')
        timezone = request.data.get('timezone')
        
        if name is not None:
            name = str(name).strip()
            if not name:
                return Response({'error': 'Property name cannot be empty'}, status=status.HTTP_400_BAD_REQUEST)
            prop.name = name
            
        if currency is not None:
            prop.currency = str(currency).strip().upper()
            
        if tax_rate is not None:
            try:
                tax_val = float(tax_rate)
                if tax_val < 0:
                    return Response({'error': 'Tax rate cannot be negative'}, status=status.HTTP_400_BAD_REQUEST)
                prop.tax_rate = tax_val
            except (ValueError, TypeError):
                return Response({'error': 'Invalid tax rate format'}, status=status.HTTP_400_BAD_REQUEST)
                
        if timezone is not None:
            prop.timezone = str(timezone).strip()
            
        prop.save()
        return Response({
            'property': {
                'id': str(prop.id),
                'name': prop.name,
                'currency': prop.currency,
                'taxRate': str(prop.tax_rate),
                'timezone': prop.timezone
            }
        })

class LocationListView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), IsPropertyStaff()]
        return [IsAuthenticated(), IsPropertyManagerOrAdmin()]
    
    def get(self, request, property_id):
        locations = ServiceLocation.objects.filter(property_id=property_id, active=True)
        data = [{
            'id': str(l.id),
            'label': l.label,
            'kind': l.kind,
            'capacity': l.capacity,
            'active': l.active,
            'qrToken': l.qr_token
        } for l in locations]
        return Response({'locations': data})

    def post(self, request, property_id):
        import uuid
        label = request.data.get('label', '').strip()
        kind = request.data.get('kind', 'table')
        capacity = request.data.get('capacity', 2)

        if not label:
            return Response({'error': 'Label is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Generate a unique QR token
        qr_token = str(uuid.uuid4().hex)[:16]

        try:
            loc = ServiceLocation.objects.create(
                property_id=property_id,
                label=label,
                kind=kind,
                capacity=capacity,
                qr_token=qr_token
            )
            return Response({'createLocation': {
                'id': str(loc.id),
                'label': loc.label,
                'kind': loc.kind,
                'capacity': loc.capacity,
                'active': loc.active,
                'qrToken': loc.qr_token
            }})
        except Exception as e:
            return Response({'error': 'Failed to create location. Label must be unique.'}, status=status.HTTP_400_BAD_REQUEST)

class MenuListView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated(), IsPropertyStaff()]
        return [IsAuthenticated(), IsPropertyManagerOrAdmin()]
    
    def get(self, request, property_id):
        items = MenuItem.objects.filter(property_id=property_id, available=True)
        data = [{
            'id': str(i.id),
            'name': i.name,
            'description': i.description,
            'category': i.category,
            'subCategory': i.sub_category,
            'dietaryPreference': i.dietary_preference,
            'price': str(i.price),
            'imageUrl': i.image_url,
            'available': i.available,
            'isBestseller': i.is_bestseller,
            'preparationTime': i.preparation_time,
            'gstRate': str(i.gst_rate),
            'discountPercentage': str(i.discount_percentage),
            'stockQuantity': i.stock_quantity,
            'ingredients': i.ingredients,
            'spiceLevel': i.spice_level,
            'prepStation': i.prep_station
        } for i in items]
        return Response({'menu': data})

    def post(self, request, property_id):
        data = request.data.get('data', {})
        price = data.get('price', 0)
        if float(price) < 0:
            return Response({'error': 'Price cannot be negative'}, status=status.HTTP_400_BAD_REQUEST)
        
        item = MenuItem.objects.create(
            property_id=property_id,
            name=data.get('name', '').strip(),
            description=data.get('description', ''),
            category=data.get('category', 'General'),
            sub_category=data.get('subCategory', None),
            dietary_preference=data.get('dietaryPreference', 'veg'),
            image_url=data.get('imageUrl', None),
            price=price,
            is_bestseller=data.get('isBestseller', False),
            preparation_time=data.get('preparationTime', None),
            gst_rate=data.get('gstRate', 5.00),
            discount_percentage=data.get('discountPercentage', 0.00),
            stock_quantity=data.get('stockQuantity', None),
            ingredients=data.get('ingredients', ''),
            spice_level=data.get('spiceLevel', None),
            prep_station=data.get('prepStation', 'main')
        )
        return Response({'createMenuItem': {
            'id': str(item.id),
            'name': item.name,
            'description': item.description,
            'category': item.category,
            'subCategory': item.sub_category,
            'dietaryPreference': item.dietary_preference,
            'imageUrl': item.image_url,
            'price': str(item.price),
            'available': item.available,
            'isBestseller': item.is_bestseller,
            'preparationTime': item.preparation_time,
            'gstRate': str(item.gst_rate),
            'discountPercentage': str(item.discount_percentage),
            'stockQuantity': item.stock_quantity,
            'ingredients': item.ingredients,
            'spiceLevel': item.spice_level,
            'prepStation': item.prep_station
        }})

class MenuItemDetailView(APIView):
    permission_classes = [IsAuthenticated, IsPropertyManagerOrAdmin]
    
    def put(self, request, pk):
        item = get_object_or_404(MenuItem, id=pk)
        self.check_object_permissions(request, item)
        data = request.data.get('data', {})
        
        if 'name' in data: item.name = data['name'].strip()
        if 'description' in data: item.description = data['description']
        if 'category' in data: item.category = data['category']
        if 'subCategory' in data: item.sub_category = data['subCategory']
        if 'dietaryPreference' in data: item.dietary_preference = data['dietaryPreference']
        if 'imageUrl' in data: item.image_url = data['imageUrl']
        if 'price' in data:
            if float(data['price']) < 0:
                return Response({'error': 'Price cannot be negative'}, status=status.HTTP_400_BAD_REQUEST)
            item.price = data['price']
        if 'available' in data: item.available = data['available']
        if 'isBestseller' in data: item.is_bestseller = data['isBestseller']
        if 'preparationTime' in data: item.preparation_time = data['preparationTime']
        if 'gstRate' in data: item.gst_rate = data['gstRate']
        if 'discountPercentage' in data: item.discount_percentage = data['discountPercentage']
        if 'stockQuantity' in data: item.stock_quantity = data['stockQuantity']
        if 'ingredients' in data: item.ingredients = data['ingredients']
        if 'spiceLevel' in data: item.spice_level = data['spiceLevel']
        if 'prepStation' in data: item.prep_station = data['prepStation']
        
        item.save()
        return Response({'updateMenuItem': {
            'id': str(item.id),
            'name': item.name,
            'description': item.description,
            'category': item.category,
            'subCategory': item.sub_category,
            'dietaryPreference': item.dietary_preference,
            'imageUrl': item.image_url,
            'price': str(item.price),
            'available': item.available,
            'isBestseller': item.is_bestseller,
            'preparationTime': item.preparation_time,
            'gstRate': str(item.gst_rate),
            'discountPercentage': str(item.discount_percentage),
            'stockQuantity': item.stock_quantity,
            'ingredients': item.ingredients,
            'spiceLevel': item.spice_level,
            'prepStation': item.prep_station
        }})

    def delete(self, request, pk):
        item = get_object_or_404(MenuItem, id=pk)
        self.check_object_permissions(request, item)
        item.delete()
        return Response({'deleteMenuItem': True})

class UploadImageView(APIView):
    permission_classes = [IsAuthenticated, IsPropertyManagerOrAdmin]
    
    def post(self, request):
        try:
            import cloudinary
            import cloudinary.uploader
            import os
            
            # Configure cloudinary
            cloudinary.config(
                cloud_name=os.environ.get('CLOUDINARY_CLOUD_NAME'),
                api_key=os.environ.get('CLOUDINARY_API_KEY'),
                api_secret=os.environ.get('CLOUDINARY_API_SECRET')
            )
            
            if 'file' not in request.FILES:
                return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
                
            file = request.FILES['file']
            
            result = cloudinary.uploader.upload(file)
            return Response({'url': result['secure_url']})
        except Exception as e:
            import traceback
            return Response({'error': str(e), 'trace': traceback.format_exc()}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class GuestContextView(APIView):
    # No permission_classes = [IsAuthenticated] here, this is public
    def get(self, request, qr_token):
        location = get_object_or_404(ServiceLocation, qr_token=qr_token, active=True)
        property = location.property
        
        if not property.active:
            return Response({'error': 'Property is not active'}, status=status.HTTP_400_BAD_REQUEST)
            
        items = MenuItem.objects.filter(property=property, available=True)
        menu_data = [{
            'id': str(i.id),
            'name': i.name,
            'description': i.description,
            'category': i.category,
            'subCategory': i.sub_category,
            'dietaryPreference': i.dietary_preference,
            'imageUrl': i.image_url,
            'price': str(i.price),
            'isBestseller': i.is_bestseller,
            'preparationTime': i.preparation_time,
            'gstRate': str(i.gst_rate),
            'discountPercentage': str(i.discount_percentage),
            'stockQuantity': i.stock_quantity,
            'ingredients': i.ingredients,
            'spiceLevel': i.spice_level
        } for i in items]
        
        return Response({
            'location': {
                'id': str(location.id),
                'label': location.label,
                'kind': location.kind
            },
            'property': {
                'id': str(property.id),
                'name': property.name,
                'currency': property.currency
            },
            'menu': menu_data
        })

from django.http import HttpResponse
from .posters import generate_poster_pdf, generate_poster_image
from .models import Property, ServiceLocation

from django.views import View
from django.http import JsonResponse, HttpResponse

class LocationPosterDownloadView(View):
    def get(self, request, property_id, location_id):
        prop = get_object_or_404(Property, id=property_id)
        loc = get_object_or_404(ServiceLocation, id=location_id, property_id=property_id)
        
        token = loc.qr_token
        if not token:
            return JsonResponse({"error": "No QR token for this location"}, status=400)
            
        from django.conf import settings
        base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        url = f"{base_url}/guest/{token}"
        
        fmt = request.GET.get('format', 'pdf').lower()
        filename_prefix = f"Poster-{loc.label.replace(' ', '-')}"
        
        if fmt == 'png':
            image_data = generate_poster_image(prop.name, loc.label, url)
            response = HttpResponse(image_data, content_type='image/png')
            response['Content-Disposition'] = f'attachment; filename="{filename_prefix}.png"'
            return response
        else:
            pdf_data = generate_poster_pdf(prop.name, loc.label, url)
            response = HttpResponse(pdf_data, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename_prefix}.pdf"'
            return response

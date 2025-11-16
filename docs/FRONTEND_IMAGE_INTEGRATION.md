# Frontend Image Integration Guide

## Overview

The Origin Food House backend stores **base image paths** (not full URLs) in the database. Frontend applications must construct image URLs dynamically by combining the S3 base URL with the image path and desired size.

This approach provides maximum flexibility, zero backend bandwidth for images, and allows easy CDN integration.

---

## Configuration

### Environment Variables

Add the S3 base URL to your frontend environment configuration:

```bash
# .env (React/Vite)
VITE_S3_BASE_URL=https://your-bucket.s3.us-east-1.amazonaws.com

# .env.local (Next.js)
NEXT_PUBLIC_S3_BASE_URL=https://your-bucket.s3.us-east-1.amazonaws.com
```

**Note**: Replace with your actual S3 bucket URL or CDN URL (e.g., CloudFront).

---

## Image Path Format

### Database Storage
The database stores **base paths without version suffixes**:

```typescript
{
  imagePath: "uploads/abc-123-def-456"  // Base path only
}
```

### Available Sizes

Images are generated in multiple sizes:
- **original**: Original dimensions (kept for some presets)
- **small**: 400px width
- **medium**: 800px width
- **large**: 1200px width

### File Naming Convention

Each size version is stored as:
```
{basePath}-{size}.webp
```

**Examples**:
- `uploads/abc-123-def-456-small.webp`
- `uploads/abc-123-def-456-medium.webp`
- `uploads/abc-123-def-456-large.webp`

---

## URL Construction Utility

### TypeScript/JavaScript

```typescript
// utils/image.ts

const S3_BASE_URL = import.meta.env.VITE_S3_BASE_URL; // or process.env.NEXT_PUBLIC_S3_BASE_URL

export type ImageSize = 'original' | 'small' | 'medium' | 'large';

/**
 * Constructs a full S3 URL from a base path and size.
 *
 * @param basePath Base image path from API (e.g., "uploads/abc-123")
 * @param size Desired image size
 * @param extension File extension (default: '.webp')
 * @returns Full S3 URL or null if basePath is null
 *
 * @example
 * getImageUrl("uploads/abc-123", "medium")
 * // Returns: "https://bucket.s3.region.amazonaws.com/uploads/abc-123-medium.webp"
 */
export function getImageUrl(
  basePath: string | null | undefined,
  size: ImageSize = 'medium',
  extension: string = '.webp'
): string | null {
  if (!basePath) return null;

  return `${S3_BASE_URL}/${basePath}-${size}${extension}`;
}

/**
 * Generates srcset for responsive images.
 *
 * @param basePath Base image path from API
 * @param sizes Array of sizes to include in srcset
 * @returns srcset string for <img> tag
 *
 * @example
 * getImageSrcSet("uploads/abc-123", ["small", "medium", "large"])
 * // Returns: "https://.../uploads/abc-123-small.webp 400w, https://.../uploads/abc-123-medium.webp 800w, ..."
 */
export function getImageSrcSet(
  basePath: string | null | undefined,
  sizes: ImageSize[] = ['small', 'medium', 'large']
): string | null {
  if (!basePath) return null;

  const widths: Record<ImageSize, number> = {
    original: 0, // Original has variable width
    small: 400,
    medium: 800,
    large: 1200,
  };

  return sizes
    .filter((size) => size !== 'original') // Skip original in srcset
    .map((size) => `${getImageUrl(basePath, size)} ${widths[size]}w`)
    .join(', ');
}
```

---

## React Component Examples

### Basic Image Display

```tsx
import { getImageUrl } from '@/utils/image';

interface MenuItem {
  id: string;
  name: string;
  imagePath: string | null;
  basePrice: string;
}

function MenuItemCard({ item }: { item: MenuItem }) {
  return (
    <div className="menu-item">
      {item.imagePath && (
        <img
          src={getImageUrl(item.imagePath, 'medium')}
          alt={item.name}
          width={800}
          height={600}
        />
      )}
      <h3>{item.name}</h3>
      <p>${item.basePrice}</p>
    </div>
  );
}
```

### Responsive Images with srcset

```tsx
import { getImageUrl, getImageSrcSet } from '@/utils/image';

function ResponsiveMenuImage({ item }: { item: MenuItem }) {
  return (
    <img
      src={getImageUrl(item.imagePath, 'medium')}
      srcSet={getImageSrcSet(item.imagePath, ['small', 'medium', 'large'])}
      sizes="(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px"
      alt={item.name}
      loading="lazy"
    />
  );
}
```

### Next.js Image Component

```tsx
import Image from 'next/image';
import { getImageUrl } from '@/utils/image';

function MenuItemImage({ item }: { item: MenuItem }) {
  const imageSrc = item.imagePath
    ? getImageUrl(item.imagePath, 'large')
    : '/placeholder-food.jpg';

  return (
    <Image
      src={imageSrc}
      alt={item.name}
      width={1200}
      height={900}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      placeholder="blur"
      blurDataURL="/blur-placeholder.jpg"
    />
  );
}
```

### Dynamic Size Selection

```tsx
import { useState } from 'react';
import { getImageUrl, ImageSize } from '@/utils/image';

function ZoomableImage({ basePath }: { basePath: string }) {
  const [size, setSize] = useState<ImageSize>('medium');

  return (
    <div>
      <img src={getImageUrl(basePath, size)} alt="Zoomable" />
      <div className="size-controls">
        <button onClick={() => setSize('small')}>Small</button>
        <button onClick={() => setSize('medium')}>Medium</button>
        <button onClick={() => setSize('large')}>Large</button>
      </div>
    </div>
  );
}
```

---

## API Response Examples

### Upload Image Response

**POST** `/upload/image`

```json
{
  "status": "success",
  "message": "Image uploaded and processed successfully",
  "data": {
    "basePath": "uploads/abc-123-def-456",
    "availableSizes": ["small", "medium", "large"],
    "primarySize": "medium",
    "metadata": {
      "originalWidth": 1920,
      "originalHeight": 1080,
      "format": "jpeg",
      "originalSize": 2048576,
      "hasAlpha": false,
      "space": "srgb",
      "versions": {
        "small": {
          "width": 400,
          "height": 225,
          "size": 51200
        },
        "medium": {
          "width": 800,
          "height": 450,
          "size": 102400
        },
        "large": {
          "width": 1200,
          "height": 675,
          "size": 204800
        }
      }
    }
  }
}
```

### Menu Item Response

**GET** `/menu/:storeId/items`

```json
[
  {
    "id": "item-123",
    "name": "Pad Thai",
    "description": "Thai stir-fried noodles",
    "basePrice": "12.99",
    "imagePath": "uploads/abc-123-def-456",
    "categoryId": "cat-789",
    "storeId": "store-001",
    ...
  }
]
```

**Frontend URL Construction**:
```typescript
const menuItem = response.data[0];
const imageUrl = getImageUrl(menuItem.imagePath, 'medium');
// Result: "https://bucket.s3.us-east-1.amazonaws.com/uploads/abc-123-def-456-medium.webp"
```

### Store Information Response

**GET** `/store/:storeId`

```json
{
  "id": "store-123",
  "slug": "my-restaurant",
  "information": {
    "name": "My Restaurant",
    "logoPath": "uploads/logo-456-def",
    "coverPhotoPath": "uploads/cover-789-ghi",
    "address": "123 Main St",
    ...
  }
}
```

**Frontend URL Construction**:
```typescript
const logo = getImageUrl(store.information.logoPath, 'small');
const cover = getImageUrl(store.information.coverPhotoPath, 'large');
```

---

## Upload Flow

### 1. Upload Image

```typescript
async function uploadMenuItemImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('sizePreset', 'menu-item'); // Optional

  const response = await fetch(`${API_URL}/upload/image`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const result = await response.json();

  // Store basePath in your state/form
  return result.data.basePath; // "uploads/abc-123-def"
}
```

### 2. Create Menu Item with Image

```typescript
async function createMenuItem(data: CreateMenuItemDto) {
  const response = await fetch(`${API_URL}/menu/${storeId}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: data.name,
      basePrice: data.basePrice,
      imagePath: data.imagePath, // ← Base path from upload
      ...
    }),
  });

  return response.json();
}
```

### 3. Display Menu Item

```tsx
function MenuItemCard({ item }: { item: MenuItem }) {
  return (
    <div>
      <img
        src={getImageUrl(item.imagePath, 'medium')}
        alt={item.name}
      />
      <h3>{item.name}</h3>
      <p>${item.basePrice}</p>
    </div>
  );
}
```

---

## Image Size Presets

Different image types use different size presets:

| Image Type | Preset | Generated Sizes | Primary | Use Case |
|------------|--------|-----------------|---------|----------|
| Menu Items | `menu-item` | small, medium, large | medium | Product displays |
| Store Logos | `store-logo` | small, medium | medium | Headers, branding |
| Cover Photos | `cover-photo` | small, medium, large | large | Hero images |
| Payment Proofs | `payment-proof` | original | original | Documents (PDFs) |

### Usage with Presets

```typescript
// Upload with specific preset
formData.append('sizePreset', 'store-logo');

// API returns appropriate sizes for that preset
{
  "basePath": "uploads/logo-123",
  "availableSizes": ["small", "medium"],  // Only 2 sizes for logos
  "primarySize": "medium"
}
```

---

## Best Practices

### 1. Use Responsive Images

Always provide srcset for better performance:

```tsx
<img
  src={getImageUrl(imagePath, 'medium')}
  srcSet={getImageSrcSet(imagePath, ['small', 'medium', 'large'])}
  sizes="(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px"
  loading="lazy"
  alt={altText}
/>
```

### 2. Handle Null Images

```tsx
function MenuImage({ imagePath, name }: { imagePath: string | null; name: string }) {
  const imageUrl = imagePath
    ? getImageUrl(imagePath, 'medium')
    : '/placeholder-food.jpg';

  return <img src={imageUrl} alt={name} />;
}
```

### 3. Use Appropriate Size for Context

```typescript
// Thumbnail in list view
<img src={getImageUrl(item.imagePath, 'small')} />

// Full product view
<img src={getImageUrl(item.imagePath, 'large')} />

// Logo in header
<img src={getImageUrl(store.logoPath, 'small')} />

// Hero banner
<img src={getImageUrl(store.coverPhotoPath, 'large')} />
```

### 4. Optimize with Lazy Loading

```tsx
<img
  src={getImageUrl(imagePath, 'medium')}
  loading="lazy"  // ← Browser-native lazy loading
  decoding="async"  // ← Asynchronous image decoding
  alt={name}
/>
```

---

## Migration from Old URL-Based System

If migrating from the old system where the API returned full URLs:

### Old Format
```json
{
  "imageUrl": "https://bucket.s3.region.amazonaws.com/uploads/uuid-medium.webp"
}
```

### New Format
```json
{
  "imagePath": "uploads/uuid"
}
```

### Migration Steps

1. **Update Environment**:
   ```bash
   # Add to .env
   VITE_S3_BASE_URL=https://your-bucket.s3.us-east-1.amazonaws.com
   ```

2. **Create Utility Function**:
   ```typescript
   // Copy the getImageUrl function from above
   ```

3. **Update Components**:
   ```tsx
   // Before
   <img src={menuItem.imageUrl} alt={menuItem.name} />

   // After
   <img src={getImageUrl(menuItem.imagePath, 'medium')} alt={menuItem.name} />
   ```

4. **Update Form Submissions**:
   ```tsx
   // Before
   formData.imageUrl = uploadResult.data.imageUrl;

   // After
   formData.imagePath = uploadResult.data.basePath;
   ```

---

## CDN Integration

To use a CDN (e.g., CloudFront) instead of direct S3 access:

1. **Update Environment Variable**:
   ```bash
   # Instead of S3 URL:
   VITE_S3_BASE_URL=https://d1234567890.cloudfront.net

   # Or custom domain:
   VITE_S3_BASE_URL=https://cdn.yourdomain.com
   ```

2. **No Code Changes Required**:
   - Frontend code remains the same
   - All image URLs automatically use CDN
   - Easy to switch between S3, CloudFront, or other CDNs

---

## Performance Optimization

### Using Picture Element for Art Direction

```tsx
<picture>
  <source
    media="(max-width: 640px)"
    srcSet={getImageUrl(imagePath, 'small')}
  />
  <source
    media="(max-width: 1024px)"
    srcSet={getImageUrl(imagePath, 'medium')}
  />
  <img
    src={getImageUrl(imagePath, 'large')}
    alt={altText}
    loading="lazy"
  />
</picture>
```

### Preloading Critical Images

```tsx
// In <head> or Next.js _document.tsx
<link
  rel="preload"
  as="image"
  href={getImageUrl(store.logoPath, 'small')}
/>
```

---

## Troubleshooting

### Image Not Loading

1. **Check base URL configuration**:
   ```typescript
   console.log('S3 Base URL:', import.meta.env.VITE_S3_BASE_URL);
   ```

2. **Verify path format**:
   ```typescript
   console.log('Image Path:', menuItem.imagePath);
   // Should be: "uploads/abc-123-def" (no version suffix)
   ```

3. **Check constructed URL**:
   ```typescript
   const url = getImageUrl(menuItem.imagePath, 'medium');
   console.log('Constructed URL:', url);
   // Should be: "https://bucket.s3.region.amazonaws.com/uploads/abc-123-def-medium.webp"
   ```

4. **Verify CORS** (if direct S3 access):
   - S3 bucket must allow CORS from your frontend domain
   - Check browser console for CORS errors

### Wrong Image Size

```typescript
// Double-check available sizes from upload response
console.log('Available Sizes:', uploadResult.data.availableSizes);
// Should be: ["small", "medium", "large"]

// Ensure you're requesting an available size
const size = uploadResult.data.availableSizes.includes('large') ? 'large' : 'medium';
```

---

## API Endpoints Reference

### Upload Image
- **Endpoint**: `POST /upload/image`
- **Body**: `multipart/form-data` with `file` field
- **Optional**: `sizePreset` (menu-item, store-logo, cover-photo, payment-proof)
- **Returns**: `{ basePath, availableSizes, primarySize, metadata }`

### Create/Update Menu Item
- **Endpoint**: `POST /menu/:storeId/items` or `PATCH /menu/:storeId/items/:id`
- **Body**: `{ name, basePrice, imagePath, ... }`
- **Returns**: Menu item with `imagePath` field

### Update Store Information
- **Endpoint**: `PATCH /store/:storeId/information`
- **Body**: `{ name, logoPath, coverPhotoPath, ... }`
- **Returns**: Store information with `logoPath` and `coverPhotoPath`

---

## Summary

**Backend stores**: Base paths (`"uploads/uuid"`)
**Frontend constructs**: Full URLs (`baseUrl + basePath + "-" + size + ".webp"`)
**Benefits**: Zero backend bandwidth, easy CDN integration, flexible infrastructure

For additional questions or support, refer to the backend API documentation at `/api/docs` (Swagger UI).

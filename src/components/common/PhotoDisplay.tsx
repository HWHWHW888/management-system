import React from 'react';
import { Badge } from '../ui/badge';
import { ImageWithFallback } from '../figma/ImageWithFallback';

interface PhotoDisplayProps {
  photos: Array<{
    id: string;
    photo: {
      data: string;
      filename?: string;
      size?: number;
      type?: string;
    };
    status?: string;
    upload_date?: string;
    transaction_date?: string;
  }>;
  type?: 'passport' | 'transaction' | 'rolling';
  size?: 'small' | 'medium' | 'large';
  maxPhotos?: number;
  onPhotoClick?: (photo: any) => void;
}

export const PhotoDisplay: React.FC<PhotoDisplayProps> = ({
  photos,
  type = 'transaction',
  size = 'medium',
  maxPhotos = 4,
  onPhotoClick
}) => {
  // 统一的照片数据验证
  const isValidPhotoData = (photoData: string) => {
    if (!photoData) return false;
    return photoData.startsWith('data:image/') && 
           !photoData.includes('base64,test') && 
           photoData.length > 100;
  };

  // 过滤有效照片
  const validPhotos = photos.filter(photo => 
    photo.photo?.data && isValidPhotoData(photo.photo.data)
  );

  // 显示的照片（限制数量）
  const displayPhotos = validPhotos.slice(0, maxPhotos);

  // 统一的尺寸样式
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'h-16 w-16'; // 64px x 64px
      case 'medium':
        return 'h-24 w-24'; // 96px x 96px  
      case 'large':
        return 'h-32 w-32'; // 128px x 128px
      default:
        return 'h-24 w-24';
    }
  };

  // 网格布局类
  const getGridClasses = () => {
    if (displayPhotos.length === 1) return 'grid-cols-1';
    if (displayPhotos.length <= 2) return 'grid-cols-2';
    return 'grid-cols-2';
  };

  // 状态颜色
  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  // 默认点击处理（打开模态框）
  const handlePhotoClick = (photo: any) => {
    if (onPhotoClick) {
      onPhotoClick(photo);
      return;
    }

    // 默认模态框实现
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="relative max-w-4xl max-h-4xl p-4">
        <img src="${photo.photo.data}" class="max-w-full max-h-full object-contain rounded" />
        <button class="absolute top-2 right-2 text-white bg-black bg-opacity-50 rounded-full w-8 h-8 flex items-center justify-center hover:bg-opacity-75">×</button>
        <div class="absolute bottom-2 left-2 text-white bg-black bg-opacity-50 px-2 py-1 rounded text-sm">
          ${photo.upload_date ? new Date(photo.upload_date).toLocaleDateString() : ''} 
          ${photo.status ? `- ${photo.status}` : ''}
          ${photo.photo.filename ? `- ${photo.photo.filename}` : ''}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target === modal || target?.textContent === '×') {
        document.body.removeChild(modal);
      }
    });
  };

  if (displayPhotos.length === 0) {
    return (
      <div className={`${getSizeClasses()} bg-gray-100 rounded border flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-6 h-6 mx-auto mb-1 opacity-30">
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-xs text-gray-400">No photo</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className={`grid ${getGridClasses()} gap-2`}>
        {displayPhotos.map((photo, index) => (
          <div key={photo.id} className="relative group cursor-pointer">
            <ImageWithFallback
              src={photo.photo.data}
              alt={`${type} ${index + 1}`}
              className={`${getSizeClasses()} object-cover rounded border hover:border-blue-300 transition-colors`}
              onClick={() => handlePhotoClick(photo)}
            />
            {photo.status && (
              <Badge className={`absolute bottom-1 right-1 text-xs ${getStatusBadgeClass(photo.status)}`}>
                {photo.status.charAt(0).toUpperCase() + photo.status.slice(1)}
              </Badge>
            )}
          </div>
        ))}
      </div>
      
      {validPhotos.length > maxPhotos && (
        <p className="text-xs text-gray-500 text-center">
          +{validPhotos.length - maxPhotos} more photos
        </p>
      )}
    </div>
  );
};

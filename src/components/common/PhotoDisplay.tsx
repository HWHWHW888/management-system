import React from 'react';
import { Badge } from '../ui/badge';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { X, Download } from 'lucide-react';

// CSS 样式用于自定义滚动条
const scrollbarStyles = `
  .photo-scroll-container::-webkit-scrollbar {
    width: 6px;
  }
  .photo-scroll-container::-webkit-scrollbar-track {
    background: #f7fafc;
    border-radius: 3px;
  }
  .photo-scroll-container::-webkit-scrollbar-thumb {
    background: #cbd5e0;
    border-radius: 3px;
  }
  .photo-scroll-container::-webkit-scrollbar-thumb:hover {
    background: #a0aec0;
  }
`;

// 将样式注入到页面中
if (typeof document !== 'undefined' && !document.getElementById('photo-scroll-styles')) {
  const style = document.createElement('style');
  style.id = 'photo-scroll-styles';
  style.textContent = scrollbarStyles;
  document.head.appendChild(style);
}

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
  onPhotoDelete?: (photoId: string) => void;
  showDelete?: boolean;
  showDownload?: boolean;
  userRole?: string;
  customerName?: string;
}

export const PhotoDisplay: React.FC<PhotoDisplayProps> = ({
  photos,
  type = 'transaction',
  size = 'medium',
  maxPhotos = 4,
  onPhotoClick,
  onPhotoDelete,
  showDelete = true,
  showDownload = false,
  userRole = '',
  customerName = ''
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

  // 统一的尺寸样式 - 响应式高度
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'h-24 sm:h-20 w-full'; // 小尺寸：移动端24，桌面端20
      case 'medium':
        return 'h-32 sm:h-24 w-full'; // 中尺寸：移动端32，桌面端24
      case 'large':
        return 'h-40 sm:h-32 w-full'; // 大尺寸：移动端40，桌面端32
      default:
        return 'h-32 sm:h-24 w-full';
    }
  };

  // 网格布局类 - 移动优先设计
  const getGridClasses = () => {
    if (size === 'large') {
      // 大尺寸照片 (ProjectManagement)
      if (validPhotos.length === 1) return 'grid-cols-1';
      return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    } else {
      // 中小尺寸照片 (StaffSelfService)
      if (validPhotos.length === 1) return 'grid-cols-1';
      return 'grid-cols-1 sm:grid-cols-2';
    }
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

  // 下载照片功能
  const handlePhotoDownload = (photo: any) => {
    if (userRole !== 'admin') {
      alert('只有管理员可以下载照片');
      return;
    }

    try {
      // 创建下载链接
      const link = document.createElement('a');
      link.href = photo.photo.data;
      
      // 生成文件名：CustomerName.Type.Date
      const timestamp = photo.transaction_date ? 
        new Date(photo.transaction_date).toISOString().split('T')[0] : 
        new Date().toISOString().split('T')[0];
      
      // 清理客户名称，移除特殊字符
      const cleanCustomerName = customerName ? 
        customerName.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_') : 
        'Customer';
      
      // 首字母大写的类型
      const typeCapitalized = type.charAt(0).toUpperCase() + type.slice(1);
      
      const filename = `${cleanCustomerName}.${typeCapitalized}.${timestamp}.jpg`;
      
      link.download = filename;
      link.style.display = 'none';
      
      // 添加到页面，点击下载，然后移除
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ Photo downloaded:', filename);
    } catch (error) {
      console.error('Download failed:', error);
      alert('下载失败，请重试');
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
    <div className="space-y-3">
      {/* 照片网格区域 - 移动端优化 */}
      <div 
        className="max-h-80 sm:max-h-64 overflow-y-auto photo-scroll-container" 
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#CBD5E0 #F7FAFC'
        }}
      >
        <div className={`grid ${getGridClasses()} gap-3 sm:gap-4 p-2 sm:p-1`}>
          {validPhotos.map((photo, index) => (
            <div key={photo.id} className="relative group">
              {/* 照片卡片 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
                {/* 照片主体 */}
                <div className="relative">
                  <ImageWithFallback
                    src={photo.photo.data}
                    alt={`${type} ${index + 1}`}
                    className={`${getSizeClasses()} object-cover cursor-pointer w-full`}
                    onClick={() => handlePhotoClick(photo)}
                  />
                  
                  {/* 状态徽章 */}
                  {photo.status && (
                    <div className="absolute top-2 left-2">
                      <Badge className={`text-xs ${getStatusBadgeClass(photo.status)} shadow-sm`}>
                        {photo.status.charAt(0).toUpperCase() + photo.status.slice(1)}
                      </Badge>
                    </div>
                  )}
                  
                  {/* 操作按钮组 - 移动端优化 */}
                  <div className="absolute top-2 right-2 flex space-x-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                    {/* 下载按钮 */}
                    {showDownload && userRole === 'admin' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePhotoDownload(photo);
                        }}
                        className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-full p-2.5 sm:p-2 shadow-lg backdrop-blur-sm z-10 transition-colors touch-manipulation"
                        title="下载照片"
                      >
                        <Download className="w-4 h-4 sm:w-3 sm:h-3" />
                      </button>
                    )}
                    {/* 删除按钮 */}
                    {showDelete && onPhotoDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('确定要删除这张照片吗？')) {
                            onPhotoDelete(photo.id);
                          }
                        }}
                        className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-full p-2.5 sm:p-2 shadow-lg backdrop-blur-sm z-10 transition-colors touch-manipulation"
                        title="删除照片"
                      >
                        <X className="w-4 h-4 sm:w-3 sm:h-3" />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* 照片信息栏 - 移动端优化 */}
                {photo.transaction_date && (
                  <div className="px-3 py-2.5 sm:py-2 bg-gray-50 border-t">
                    <div className="text-sm sm:text-xs text-gray-600 text-center font-medium">
                      {new Date(photo.transaction_date).toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* 照片统计信息 - 移动端优化 */}
      {validPhotos.length > 0 && (
        <div className="flex items-center justify-center space-x-2 text-sm sm:text-xs text-gray-500 bg-gray-50 rounded-md py-2.5 sm:py-2">
          <span className="font-medium">{validPhotos.length}</span>
          <span>{validPhotos.length === 1 ? 'photo' : 'photos'}</span>
        </div>
      )}
    </div>
  );
};

import React, { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { FileAttachment } from '../types';
import { Upload, Download, Trash2, Eye, X, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

interface FileUploadProps {
  attachments?: FileAttachment[]; // Made optional with default
  onAttachmentsChange: (attachments: FileAttachment[]) => void;
  currentUser?: string; // Made optional
  maxFileSize?: number; // in MB
  allowedTypes?: string[];
  disabled?: boolean;
  onUpload?: (newAttachments: FileAttachment[]) => void; // Alternative callback pattern
}

export function FileUpload({ 
  attachments = [], // Default to empty array
  onAttachmentsChange, 
  currentUser = 'Unknown User', // Default value
  maxFileSize = 5,
  allowedTypes = ['image/*', 'application/pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'],
  disabled = false,
  onUpload
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);

  // Ensure attachments is always an array
  const safeAttachments = Array.isArray(attachments) ? attachments : [];

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type === 'application/pdf') return '📄';
    if (type.includes('word') || type.includes('doc')) return '📝';
    if (type.includes('sheet') || type.includes('excel')) return '📊';
    if (type.includes('text')) return '📄';
    return '📁';
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setUploading(true);

    try {
      const newAttachments: FileAttachment[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate file size
        if (file.size > maxFileSize * 1024 * 1024) {
          setError(`File "${file.name}" is too large. Maximum size is ${maxFileSize}MB.`);
          continue;
        }

        // Validate file type
        const isValidType = allowedTypes.some(type => {
          if (type.includes('*')) {
            return file.type.startsWith(type.replace('*', ''));
          }
          return file.type === type || file.name.toLowerCase().endsWith(type);
        });

        if (!isValidType) {
          setError(`File "${file.name}" is not a supported file type.`);
          continue;
        }

        // Convert file to base64
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const attachment: FileAttachment = {
          id: `file_${Date.now()}_${i}`,
          name: file.name,
          size: file.size,
          type: file.type,
          data: base64Data,
          uploadedAt: new Date().toISOString(),
          uploadedBy: currentUser
        };

        newAttachments.push(attachment);
      }

      if (newAttachments.length > 0) {
        // Use onUpload callback if provided, otherwise use onAttachmentsChange
        if (onUpload) {
          onUpload(newAttachments);
        } else {
          onAttachmentsChange([...safeAttachments, ...newAttachments]);
        }
      }
    } catch (err) {
      setError('Failed to upload files. Please try again.');
      console.error('File upload error:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = (attachment: FileAttachment) => {
    try {
      const link = document.createElement('a');
      link.href = attachment.data;
      link.download = attachment.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      setError('Failed to download file.');
    }
  };

  const handleDelete = (attachmentId: string) => {
    try {
      const updatedAttachments = safeAttachments.filter(att => att.id !== attachmentId);
      onAttachmentsChange(updatedAttachments);
    } catch (error) {
      console.error('Delete error:', error);
      setError('Failed to delete file.');
    }
  };

  const handlePreview = (attachment: FileAttachment) => {
    setPreviewFile(attachment);
  };

  const canPreview = (type: string) => {
    return type.startsWith('image/') || type === 'application/pdf' || type.startsWith('text/');
  };

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={allowedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />
        
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || disabled}
          className="w-full"
        >
          {uploading ? (
            <>
              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mr-2" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload Files
            </>
          )}
        </Button>

        {error && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-700">{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="ml-auto p-1 h-auto"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        <p className="text-xs text-gray-500 mt-1">
          Maximum file size: {maxFileSize}MB. Supported formats: Images, PDF, Documents, Spreadsheets
        </p>
      </div>

      {/* Attachments List - Added null safety */}
      {safeAttachments && safeAttachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">Attached Files ({safeAttachments.length})</h4>
          <div className="space-y-2">
            {safeAttachments.map((attachment) => (
              <Card key={attachment.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <span className="text-lg">{getFileIcon(attachment.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {attachment.name}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>{formatFileSize(attachment.size)}</span>
                        <span>by {attachment.uploadedBy}</span>
                        <span>{new Date(attachment.uploadedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    {canPreview(attachment.type) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreview(attachment)}
                        className="p-2"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(attachment)}
                      className="p-2"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    
                    {!disabled && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(attachment.id)}
                        className="p-2 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      {previewFile && (
        <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>{previewFile.name}</DialogTitle>
            </DialogHeader>
            <div className="overflow-auto">
              {previewFile.type.startsWith('image/') && (
                <img
                  src={previewFile.data}
                  alt={previewFile.name}
                  className="max-w-full h-auto"
                />
              )}
              
              {previewFile.type === 'application/pdf' && (
                <iframe
                  src={previewFile.data}
                  className="w-full h-96"
                  title={previewFile.name}
                />
              )}
              
              {previewFile.type.startsWith('text/') && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <pre className="whitespace-pre-wrap text-sm">
                    {/* Note: For text files, we'd need to decode the base64 content */}
                    <p className="text-gray-600">Text file preview not available. Please download to view.</p>
                  </pre>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
// Polyfill for Array.toReversed() for Node.js < 20
// This must be loaded before any metro-config modules
if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function() {
    return [...this].reverse();
  };
}

// Global handler cho unhandled promise rejections
// Suppress lỗi keep awake không cần thiết từ dependencies
if (typeof global !== 'undefined') {
  const originalUnhandledRejection = global.onunhandledrejection;
  
  global.onunhandledrejection = function(event) {
    const error = event?.reason;
    const errorMessage = error?.message || String(error || '');
    
    // Suppress lỗi keep awake - không ảnh hưởng đến chức năng
    // Lỗi này đến từ expo-modules-core khi một dependency cố gắng activate keep awake
    if (errorMessage.includes('Unable to activate keep awake') || 
        errorMessage.includes('keep awake')) {
      // Prevent default error logging
      if (event?.preventDefault) {
        event.preventDefault();
      }
      return;
    }
    
    // Gọi original handler cho các lỗi khác
    if (originalUnhandledRejection) {
      originalUnhandledRejection(event);
    }
  };
}


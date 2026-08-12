import isas, { Isas } from './index.js';
import { fileUploadAdapter } from './adapters/daisyui/file-upload.js';
import { FileUpload } from './components/file-upload/file-upload.js';

Isas.components.register('file-upload', FileUpload);
Isas.adapters.register('file-upload', fileUploadAdapter);

export default isas;
export * from './index.js';
export { fileUploadAdapter } from './adapters/daisyui/file-upload.js';
export { FileUpload } from './components/file-upload/file-upload.js';
export { FileUploadDriver } from './components/file-upload/file-upload-driver.js';
export {
    fileCategory,
    fileExtension,
    fileFingerprint,
    formatFileSize,
    normalizeFileErrors,
} from './components/file-upload/records.js';
export {
    UploadTransportRegistry,
    createEndpointTransport,
    createLivewireTransport,
    uploadTransports,
} from './components/file-upload/transports.js';

import { NativeModules } from 'react-native';

const { FastPdfModule } = NativeModules;

interface FastPdfInterface {
  createPdf(text: string, outputPath: string): Promise<string>;
  createPdfFromFile(inputPath: string, outputPath: string, options: { isHtml?: boolean, fontSize?: number }): Promise<string>;
  createStreamedPdf(inputPath: string, outputPath: string, options: { isHtml?: boolean, fontSize?: number }): Promise<string>;
  createPdfFromImages(imagePaths: string[], outputPath: string, options: { fitToPage?: boolean, quality?: number }): Promise<string>;
  createWebViewPdf(inputPath: string, outputPath: string, options: any): Promise<string>;
}

export default FastPdfModule as FastPdfInterface;

declare module "exif-parser" {
  interface ExifData {
    tags?: {
      DateTimeOriginal?: number;
      DateTime?: number;
      GPSLatitude?: number;
      GPSLongitude?: number;
      Make?: string;
      Model?: string;
      Orientation?: number;
      [key: string]: any;
    };
    imageSize?: {
      width: number;
      height: number;
    };
  }

  interface Parser {
    parse(): ExifData;
  }

  function create(buffer: Buffer): Parser;

  export = {
    create,
  };
}

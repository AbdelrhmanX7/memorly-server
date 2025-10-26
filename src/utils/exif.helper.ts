import ExifParser from "exif-parser";

/**
 * Extract timestamp from image EXIF data
 * Returns the date when the photo was taken, or null if not available
 */
export const extractImageTimestamp = (buffer: Buffer): Date | null => {
  try {
    const parser = ExifParser.create(buffer);
    const result = parser.parse();

    // Try to get the original date/time when photo was taken
    if (result.tags?.DateTimeOriginal) {
      return new Date(result.tags.DateTimeOriginal * 1000); // Convert Unix timestamp to Date
    }

    // Fallback to DateTime if DateTimeOriginal is not available
    if (result.tags?.DateTime) {
      return new Date(result.tags.DateTime * 1000);
    }

    // No timestamp found in EXIF data
    return null;
  } catch (error) {
    console.error("Error extracting EXIF timestamp:", error);
    return null;
  }
};

/**
 * Extract GPS coordinates from image EXIF data
 * Returns { latitude, longitude } or null if not available
 */
export const extractImageGPS = (
  buffer: Buffer
): { latitude: number; longitude: number } | null => {
  try {
    const parser = ExifParser.create(buffer);
    const result = parser.parse();

    if (result.tags?.GPSLatitude && result.tags?.GPSLongitude) {
      return {
        latitude: result.tags.GPSLatitude,
        longitude: result.tags.GPSLongitude,
      };
    }

    return null;
  } catch (error) {
    console.error("Error extracting GPS coordinates:", error);
    return null;
  }
};

/**
 * Extract all relevant EXIF metadata from image
 */
export const extractImageMetadata = (buffer: Buffer) => {
  try {
    const parser = ExifParser.create(buffer);
    const result = parser.parse();

    const timestamp = extractImageTimestamp(buffer);
    const gps = extractImageGPS(buffer);

    return {
      timestamp,
      gps,
      imageSize: result.imageSize || null,
      make: result.tags?.Make || null, // Camera manufacturer
      model: result.tags?.Model || null, // Camera model
      orientation: result.tags?.Orientation || null,
      tags: result.tags || {},
    };
  } catch (error) {
    console.error("Error extracting EXIF metadata:", error);
    return {
      timestamp: null,
      gps: null,
      imageSize: null,
      make: null,
      model: null,
      orientation: null,
      tags: {},
    };
  }
};

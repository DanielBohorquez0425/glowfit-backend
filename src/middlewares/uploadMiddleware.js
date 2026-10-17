import multer from "multer";

const MAX_MEAL_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Kept in memory only: the photo is forwarded to the AI and never stored.
const mealPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MEAL_PHOTO_BYTES, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
    }
    callback(null, true);
  },
}).single("photo");

/**
 * Parses a single "photo" field from a multipart/form-data request into req.file.
 * Translates multer errors into 4xx responses instead of bubbling them as 500s.
 */
export const uploadMealPhoto = (req, res, next) => {
  mealPhotoUpload(req, res, (error) => {
    if (!error) return next();

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "Photo is too large. Max size is 5 MB." });
    }

    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        error: "Send a single JPEG, PNG or WEBP image in the 'photo' field.",
      });
    }

    next(error);
  });
};

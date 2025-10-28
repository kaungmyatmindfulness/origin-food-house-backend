import { BadRequestException } from "@nestjs/common";
import { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";

export const imageFileFilter: MulterOptions["fileFilter"] = (
  req,
  file,
  callback,
) => {
  if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
    return callback(
      new BadRequestException(
        "Only image files (jpg, jpeg, png, webp) are allowed!",
      ),
      false,
    );
  }

  callback(null, true);
};

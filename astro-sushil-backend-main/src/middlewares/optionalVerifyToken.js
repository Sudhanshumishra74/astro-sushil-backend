// middleware/optionalVerifyToken.js

import jwt from "jsonwebtoken";
import { User } from "../modules/auth/user.modal.js";

export const optionalVerifyToken = async (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decoded._id);

    if (!user) {
      req.user = null;
      return next();
    }

    req.user = user;

    next();
  } catch (error) {
    req.user = null;
    next();
  }
};
class ErrorHandler extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  
  export const errorMiddleware = (err, req, res, next) => {
    err.message = err.message || "Internal server error.";
    err.statusCode = err.statusCode || 500;
  
    if (err.name === "JsonWebTokenError") {
      const message = "Json web token is invalid, Try again.";
      err = new ErrorHandler(message, 400);
    }
    if (err.name === "TokenExpiredError") {
      const message = "Json web token is expired, Try again.";
      err = new ErrorHandler(message, 400);
    }
    if (err.name === "CastError") {
      const message = `Invalid ${err.path}`;
      err = new ErrorHandler(message, 400);
    }
    
    /*Checks for validation errors (err.errors). If they exist, it extracts the error messages 
    for each invalid field, combines them into a single string, and assigns it to errorMessage.
    If no validation errors are present, it uses the general error message (err.message) instead.
    This ensures that either multiple validation errors or a single error message is returned 
    in a clean, user-friendly format.*/
    const errorMessage = err.errors
    ? Object.values(err.errors)
        .map((error) => error.message)
        .join(" ")
    : err.message;
  
    return res.status(err.statusCode).json({
      success: false,
      message: errorMessage,
    });
  };
  
  export default ErrorHandler;
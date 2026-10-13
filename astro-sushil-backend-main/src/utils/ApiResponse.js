class ApiResponse {
  constructor(statusCode, data = null, message = "Success", meta = null) {
    this.statusCode = statusCode;
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
    this.errors = [];
    this.meta = meta;
  }
}

export { ApiResponse };

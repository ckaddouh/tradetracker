const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({
    data: null,
    error: err.message || 'Internal server error',
  });
};

module.exports = errorHandler;

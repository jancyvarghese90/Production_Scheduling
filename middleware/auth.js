const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  // Get the token from the Authorization header
  const token = req.headers.authorization?.split(' ')[1];

  // If token doesn't exist, return 401 Unauthorized
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    // Verify the token using the secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the decoded user info to the request object
    req.user = decoded;

    // Call next to move to the next middleware or route
    next();
  } catch (error) {
    // If token is invalid or expired
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
};

module.exports = auth;

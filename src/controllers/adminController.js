const adminService = require('../services/adminService');
const authService = require('../services/authService');
const { hashPassword } = require('../utils/bcrypt');
const { USER_ROLE } = require('../config/constants');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'email and password are required',
      });
    }
    
    const result = await authService.loginAdmin(email, password);
    res.json(result);
  } catch (error) {
    if (error.message === 'Invalid credentials' || error.message === 'Access denied') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: error.message,
      });
    }
    next(error);
  }
}

async function register(req, res, next) {
  try {
    const { email, password, first_name, last_name } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'email and password are required',
      });
    }
    // Check if user already exists
    const existing = await adminService.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Email already registered',
      });
    }
    const password_hash = await hashPassword(password);
    const user = await adminService.createAdminUser({
      email,
      password_hash,
      first_name,
      last_name,
      role_id: USER_ROLE.ADMIN,
      active: true,
    });
    res.status(201).json({
      user_id: user.user_id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role_id,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  register,
};


const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

const validateRegister = [
  body('username')
    .isLength({ min: 3, max: 50 }).withMessage('Username musí mít 3-50 znaků')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username může obsahovat pouze písmena, čísla a podtržítko'),
  body('email')
    .isEmail().withMessage('Neplatný email'),
  body('password')
    .isLength({ min: 8 }).withMessage('Heslo musí mít minimálně 8 znaků')
    .matches(/[A-Z]/).withMessage('Heslo musí obsahovat alespoň jedno velké písmeno')
    .matches(/[a-z]/).withMessage('Heslo musí obsahovat alespoň jedno malé písmeno')
    .matches(/[0-9]/).withMessage('Heslo musí obsahovat alespoň jednu číslici'),
  body('role')
    .optional()
    .isIn(['admin', 'operator', 'viewer']).withMessage('Neplatná role'),
  body('fullName')
    .optional()
    .isLength({ max: 255 }).withMessage('Celé jméno může mít maximálně 255 znaků'),
  handleValidationErrors
];

const validateLogin = [
  body('username').notEmpty().withMessage('Username je povinný'),
  body('password').notEmpty().withMessage('Heslo je povinné'),
  handleValidationErrors
];

const validateChangePassword = [
  body('oldPassword').notEmpty().withMessage('Staré heslo je povinné'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Nové heslo musí mít minimálně 8 znaků')
    .matches(/[A-Z]/).withMessage('Heslo musí obsahovat alespoň jedno velké písmeno')
    .matches(/[a-z]/).withMessage('Heslo musí obsahovat alespoň jedno malé písmeno')
    .matches(/[0-9]/).withMessage('Heslo musí obsahovat alespoň jednu číslici'),
  handleValidationErrors
];

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrace nového uživatele (pouze admin)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, operator, viewer]
 *               fullName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Uživatel vytvořen
 */
router.post(
  '/register',
  authenticateToken,
  requireRole(['admin']),
  validateRegister,
  authController.register
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Přihlášení uživatele
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Přihlášení úspěšné
 */
router.post('/login', validateLogin, authController.login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Obnovení access tokenu
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token obnoven
 */
router.post('/refresh', authController.refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Odhlášení uživatele
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Odhlášení úspěšné
 */
router.post('/logout', authenticateToken, authController.logout);
/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Získání informací o přihlášeném uživateli
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Informace o uživateli
 */
router.get('/me', authenticateToken, authController.me);

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     summary: Změna hesla
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [oldPassword, newPassword]
 *             properties:
 *               oldPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Heslo změněno
 */
router.put(
  '/change-password',
  authenticateToken,
  validateChangePassword,
  authController.changePassword
);

module.exports = router;

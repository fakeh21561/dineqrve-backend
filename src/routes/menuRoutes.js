const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');

// GET all menu items
router.get('/', menuController.getAllMenuItems);

// GET single menu item
router.get('/:id', menuController.getMenuItemById);

// CREATE new menu item
router.post('/', menuController.createMenuItem);

// UPDATE menu item
router.put('/:id', menuController.updateMenuItem);

// DELETE menu item
router.delete('/:id', menuController.deleteMenuItem);

module.exports = router;
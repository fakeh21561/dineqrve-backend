const db = require('../config/db');

// GET ALL MENU ITEMS (EXISTING)
const getAllMenuItems = async (req, res) => {
    try {
        const [results] = await db.query(
            'SELECT * FROM menu_items ORDER BY category, name'
        );
        res.json(results);
    } catch (error) {
        console.error('Error fetching menu items:', error);
        res.status(500).json({ error: 'Database error' });
    }
};

// GET SINGLE MENU ITEM (NEW)
const getMenuItemById = async (req, res) => {
    try {
        const { id } = req.params;
        const [results] = await db.query(
            'SELECT * FROM menu_items WHERE id = ?',
            [id]
        );
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        
        res.json(results[0]);
    } catch (error) {
        console.error('Error fetching menu item:', error);
        res.status(500).json({ error: 'Database error' });
    }
};

// CREATE NEW MENU ITEM (NEW)
const createMenuItem = async (req, res) => {
    try {
        const { name, description, price, category, image_url, is_available } = req.body;
        
        // Validation
        if (!name || !price) {
            return res.status(400).json({ error: 'Name and price are required' });
        }
        
        const [result] = await db.query(
            'INSERT INTO menu_items (name, description, price, category, image_url, is_available) VALUES (?, ?, ?, ?, ?, ?)',
            [name, description, price, category, image_url || null, is_available !== false]
        );
        
        res.status(201).json({ 
            message: 'Menu item created successfully',
            id: result.insertId 
        });
    } catch (error) {
        console.error('Error creating menu item:', error);
        res.status(500).json({ error: 'Database error' });
    }
};

// UPDATE MENU ITEM (NEW)
// UPDATE MENU ITEM
const updateMenuItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, category, image_url, is_available } = req.body;
        
        // Check if item exists
        const [check] = await db.query(
            'SELECT id FROM menu_items WHERE id = ?',
            [id]
        );
        
        if (check.length === 0) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        
        // Update WITHOUT updated_at column
        await db.query(
            `UPDATE menu_items 
             SET name = ?, description = ?, price = ?, category = ?, 
                 image_url = ?, is_available = ?
             WHERE id = ?`,
            [name, description, price, category, image_url || null, is_available, id]
        );
        
        res.json({ message: 'Menu item updated successfully' });
    } catch (error) {
        console.error('Error updating menu item:', error);
        res.status(500).json({ error: 'Database error' });
    }
};

// DELETE MENU ITEM (NEW)
const deleteMenuItem = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if item exists
        const [check] = await db.query(
            'SELECT id FROM menu_items WHERE id = ?',
            [id]
        );
        
        if (check.length === 0) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        
        // Soft delete (set is_available to false) instead of hard delete
        await db.query(
            'UPDATE menu_items SET is_available = false WHERE id = ?',
            [id]
        );
        
        res.json({ message: 'Menu item deactivated successfully' });
    } catch (error) {
        console.error('Error deleting menu item:', error);
        res.status(500).json({ error: 'Database error' });
    }
};

module.exports = {
    getAllMenuItems,
    getMenuItemById,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem
};
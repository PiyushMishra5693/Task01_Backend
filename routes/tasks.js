const express = require('express');
const { body, validationResult } = require('express-validator');
const Task = require('../models/Task');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all tasks for authenticated user
router.get('/', auth, async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = { userId: req.userId };

    // Filter by status if provided
    if (status && status !== 'all') {
      query.status = status;
    }

    // Search by title or description if provided
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const tasks = await Task.find(query).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new task
router.post('/', [
  auth,
  body('title').trim().isLength({ min: 1 }).withMessage('Title is required'),
  body('description').optional().trim(),
  body('status').optional().isIn(['pending', 'in-progress', 'completed']),
  body('priority').optional().isIn(['low', 'medium', 'high'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, status, priority } = req.body;

    const task = new Task({
      title,
      description,
      status: status || 'pending',
      priority: priority || 'medium',
      userId: req.userId
    });

    await task.save();
    res.status(201).json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update task
router.put('/:id', [
  auth,
  body('title').optional().trim().isLength({ min: 1 }).withMessage('Title cannot be empty'),
  body('description').optional().trim(),
  body('status').optional().isIn(['pending', 'in-progress', 'completed']),
  body('priority').optional().isIn(['low', 'medium', 'high'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const taskId = req.params.id;
    const updates = req.body;

    // Find task and check ownership
    const task = await Task.findOne({ _id: taskId, userId: req.userId });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Update task
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        task[key] = updates[key];
      }
    });

    await task.save();
    res.json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete task
router.delete('/:id', auth, async (req, res) => {
  try {
    const taskId = req.params.id;

    // Find and delete task, checking ownership
    const task = await Task.findOneAndDelete({ _id: taskId, userId: req.userId });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
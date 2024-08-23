const Category = require("../models/Category");

// Controller for creating a new category
exports.createCategory = async (req, res) => {
	try {
		// Extract category name and description from request body
		const { name, description } = req.body;
		
		// Check if both name and description are provided
		if (!name || !description) {
			return res.status(400).json({ 
				success: false, 
				message: "All fields are required" 
			});
		}
		
		// Create a new category with provided name and description
		const categoryDetails = await Category.create({
			name: name,
			description: description,
		});
		
		// Respond with success message upon successful creation
		return res.status(200).json({
			success: true,
			message: "Category Created Successfully",
		});
	} catch (error) {
		// Handle any errors that occur during the creation process
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

// Controller for fetching all categories
exports.showAllCategories = async (req, res) => {
	try {
		// Retrieve all categories with name and description fields
		const allCategories = await Category.find({}, { name: true, description: true });
		
		// Respond with the list of categories
		res.status(200).json({
			success: true,
			data: allCategories,
		});
	} catch (error) {
		// Handle any errors that occur during the retrieval process
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

// Controller for fetching details of a specific category including its courses
exports.categoryPageDetails = async (req, res) => {
    try {
        // Extract category ID from request body
        const { categoryId } = req.body;
        
        // Find the category by ID and populate related courses with their ratings and reviews
        const selectedCategory = await Category.findById(categoryId)
            .populate({
                path: "courses",
                match: { status: "Published" },
                populate: "ratingAndReviews",
            })
            .exec();
        
        // Check if the category exists
        if (!selectedCategory) {
            return res.status(404).json({
                success: false,
                message: 'Category not found',
            });
        }

        // Check if there are any courses under the selected category
        if (selectedCategory.courses.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No courses found for the selected category.",
            });
        }

        // Respond with the category details and courses
        return res.status(200).json({
            success: true,
            data: {
                selectedCategory,
            },
        });

    } catch (error) {
        // Handle any errors that occur during the retrieval process
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

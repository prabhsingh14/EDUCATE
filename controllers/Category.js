const Category = require("../models/Category");

exports.createCategory = async (req, res) => {
	try {
		const { name, description } = req.body;
		
        if (!name || !description) {
			return res.status(400).json({ 
                success: false, 
                message: "All fields are required" 
            });
		}
		
        const CategorysDetails = await Category.create({
			name: name,
			description: description,
		});
        
		return res.status(200).json({
			success: true,
			message: "Category Created Successfully",
		});
	} catch (error) {
		return res.status(500).json({
			success: true,
			message: error.message,
		});
	}
};

exports.showAllCategories = async (req, res) => {
	try {
		const allCategories = await Category.find({}, {name: true, description: true});
		
        res.status(200).json({
			success: true,
			data: allCategories,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

exports.categoryPageDetails = async (req, res) => {
    try {
        const {categoryId} = req.body;
        const selectedCategory = await Category.findById(categoryId)
                                            .populate({
                                                path: "courses",
                                                match: {status: "Published"},
                                                populate: "ratingAndReviews",
                                            })
                                            .exec();
        
        if(!selectedCategory) {
            return res.status(404).json({
                success:false,
                message:'Data Not Found',
            });
        }

        if (selectedCategory.courses.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No courses found for the selected category.",
            })
        }

        return res.status(200).json({
            success:true,
            data: {
                    selectedCategory,
                },
        });

    }catch(error ) {
        return res.status(500).json({
            success:false,
            message:error.message,
        });
    }
}
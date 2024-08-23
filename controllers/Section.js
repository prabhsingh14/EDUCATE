const Section = require("../models/Section");
const Course = require("../models/Course");
const SubSection = require("../models/SubSection");

// Controller function to create a new section and add it to a course
exports.createSection = async (req, res) => {
	try {
		const { sectionName, courseId } = req.body;

		// Validate that required fields are provided
		if (!sectionName || !courseId) {
			return res.status(400).json({
				success: false,
				message: "Missing required properties",
			});
		}

		// Create a new section
		const newSection = await Section.create({ sectionName });

		// Update the course to include the new section
		const updatedCourse = await Course.findByIdAndUpdate(
			courseId,
			{
				$push: {
					courseContent: newSection._id,
				},
			},
			{ new: true }
		)
			.populate({
				path: "courseContent",
				populate: {
					path: "subSection",
				},
			})
			.exec();

		res.status(200).json({
			success: true,
			message: "Section created successfully",
			updatedCourse,
		});
	} catch (error) {
		// Handle errors and respond with appropriate message
		res.status(500).json({
			success: false,
			message: "Internal server error",
			error: error.message,
		});
	}
};

// Controller function to update an existing section
exports.updateSection = async (req, res) => {
	try {
		const { sectionName, sectionId, courseId } = req.body;
		
		// Update the section with new details
		const section = await Section.findByIdAndUpdate(
			sectionId,
			{ sectionName },
			{ new: true }
		);

		// Retrieve the course and populate the updated sections
		const course = await Course.findById(courseId)
			.populate({
				path: "courseContent",
				populate: {
					path: "subSection",
				},
			})
			.exec();

		res.status(200).json({
			success: true,
			message: section,
			data: course,
		});
	} catch (error) {
		// Log error and respond with appropriate message
		console.error("Error updating section:", error);
		res.status(500).json({
			success: false,
			message: "Internal server error",
			error: error.message,
		});
	}
};

// Controller function to delete a section and remove it from the course
exports.deleteSection = async (req, res) => {
	try {
		const { sectionId, courseId } = req.body;
		
		// Remove the section from the course's content array
		await Course.findByIdAndUpdate(courseId, {
			$pull: {
				courseContent: sectionId,
			},
		});

		// Check if the section exists before attempting deletion
		const section = await Section.findById(sectionId);
		if(!section){
			return res.status(404).json({
				success: false,
				message: `Could not find the section with ${sectionId}`,
			});
		}

		// Delete associated sub-sections
		await SubSection.deleteMany({ _id: { $in: section.subSection } });
		// Delete the section
		await Section.findByIdAndDelete(sectionId);

		// Retrieve and populate the updated course content
		const course = await Course.findById(courseId)
			.populate({
				path: "courseContent",
				populate: {
					path: "subSection",
				},
			})
			.exec();

		res.status(200).json({
			success: true,
			message: "Section deleted successfully",
			data: course,
		});
	} catch (error) {
		// Log error and respond with appropriate message
		console.error("Error deleting section:", error);
		res.status(500).json({
			success: false,
			message: "Internal server error",
			error: error.message,
		});
	}
};

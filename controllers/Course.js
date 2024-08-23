const Course = require("../models/Course");
const Category = require("../models/Category");
const Section = require("../models/Section");
const SubSection = require("../models/SubSection");
const User = require("../models/User");
const { uploadImageToCloudinary } = require("../utils/fileUploader");

// Controller to create a new course
exports.createCourse = async (req, res) => {
	try {
		const userId = req.user.id;

		// Extract course details from request body
		let {
			courseName,
			courseDescription,
			whatYouWillLearn,
			price,
			tag: _tag,
			category,
			status,
			instructions: _instructions,
		} = req.body;

		const thumbnail = req.files.thumbnailImage;
		const tag = JSON.parse(_tag); // Convert stringified tag to array
		const instructions = JSON.parse(_instructions);

		// Validate required fields
		if (!courseName || !courseDescription || !whatYouWillLearn || !price || !tag || !thumbnail || !category) {
			return res.status(400).json({
				success: false,
				message: "All Fields are Mandatory",
			});
		}

		// Default status to "Draft" if not provided
		if (!status || status === undefined) {
			status = "Draft";
		}

		// Validate instructor details
		const instructorDetails = await User.findById(userId, { accountType: "Instructor" });
		if (!instructorDetails) {
			return res.status(404).json({
				success: false,
				message: "Instructor Details Not Found",
			});
		}

		// Validate category details
		const categoryDetails = await Category.findById(category);
		if (!categoryDetails) {
			return res.status(404).json({
				success: false,
				message: "Category Details Not Found",
			});
		}

		// Upload thumbnail image to Cloudinary
		const thumbnailImage = await uploadImageToCloudinary(thumbnail, process.env.FOLDER_NAME);

		// Create new course
		const newCourse = await Course.create({
			courseName,
			courseDescription,
			instructor: instructorDetails._id,
			whatYouWillLearn,
			price,
			tag,
			category: categoryDetails._id,
			thumbnail: thumbnailImage.secure_url,
			status,
			instructions,
		});

		// Add the new course to the instructor's profile
		await User.findByIdAndUpdate(instructorDetails._id, {
			$push: { courses: newCourse._id },
		}, { new: true });

		// Add the new course to the category
		await Category.findByIdAndUpdate(category, {
			$push: { course: newCourse._id },
		}, { new: true });

		// Respond with success message
		res.status(200).json({
			success: true,
			data: newCourse,
			message: "Course Created Successfully",
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({
			success: false,
			message: "Failed to create course",
			error: error.message,
		});
	}
};

// Controller to edit an existing course
exports.editCourse = async (req, res) => {
	try {
		const { courseId } = req.body;
		const updates = req.body;
		const course = await Course.findById(courseId);

		// Validate course existence
		if (!course) {
			return res.status(404).json({
				success: false,
				message: `Could not find the course with ${courseId}`,
			});
		}

		// Update thumbnail if provided
		if (req.files) {
			const thumbnail = req.files.thumbnailImage;
			const thumbnailImage = await uploadImageToCloudinary(thumbnail, process.env.FOLDER_NAME);
			course.thumbnail = thumbnailImage.secure_url;
		}

		// Apply updates to course fields
		for (const key in updates) {
			if (updates.hasOwnProperty(key)) {
				if (key === "tag" || key === "instructions" || key === "category") {
					course[key] = JSON.parse(updates[key]); // Parse JSON strings
				} else {
					course[key] = updates[key];
				}
			}
		}

		// Save updated course
		await course.save();

		// Fetch updated course with populated fields
		const updatedCourse = await Course.findOne({ _id: courseId })
			.populate({
				path: "instructor",
				populate: {
					path: "additionalDetails",
				},
			})
			.populate("category")
			.populate("ratingAndReviews")
			.populate({
				path: "courseContent",
				populate: {
					path: "subSection",
				},
			})
			.exec();

		// Respond with success message and updated course data
		res.json({
			success: true,
			message: "Course Updated Successfully",
			data: updatedCourse,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({
			success: false,
			message: "Failed to edit course",
			error: error.message,
		});
	}
};

// Controller to get all courses
exports.getAllCourses = async (req, res) => {
	try {
		const allCourses = await Course.find({}, {
			courseName: true,
			price: true,
			thumbnail: true,
			instructor: true,
			ratingAndReviews: true,
			studentsEnrolled: true,
		})
			.populate("instructor")
			.exec();

		// Respond with all courses
		return res.status(200).json({
			success: true,
			data: allCourses,
		});
	} catch (error) {
		console.log(error);
		return res.status(404).json({
			success: false,
			message: "Can't Fetch Course Data",
			error: error.message,
		});
	}
};

// Controller to get details of a specific course
exports.getCourseDetails = async (req, res) => {
    try {
        const { courseId } = req.body;

		// Fetch course details with populated fields
		const courseDetails = await Course.find({ _id: courseId })
			.populate({
				path: "instructor",
				populate: {
					path: "additionalDetails",
				},
			})
			.populate("category")
			.populate({
				path: "courseContent",
				populate: {
					path: "subSection",
				},
			})
			.exec();

		// Validate course existence
		if (!courseDetails) {
			return res.status(400).json({
				success: false,
				message: `Could not find the course with ${courseId}`,
			});
		}

		// Respond with course details
		return res.status(200).json({
			success: true,
			message: "Course Details fetched successfully",
			data: courseDetails,
		});
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Controller to delete a specific course
exports.deleteCourse = async (req, res) => {
	try {
		const { courseId } = req.body;
		const course = await Course.findById(courseId);

		// Validate course existence
		if (!course) {
			return res.status(404).json({
				success: false,
				message: `Could not find the course with ${courseId}`,
			});
		}

		// Unenroll students from the course
		const studentsEnrolled = course.studentsEnrolled;
		for (const studentId of studentsEnrolled) {
			await User.findByIdAndUpdate(studentId, {
				$pull: { courses: courseId },
			});
		}

		// Delete sections and subsections related to the course
		const courseSections = await course.courseContent;
		for (const sectionId of courseSections) {
			const section = await Section.findById(sectionId);
			if (section) {
				const subSections = section.subSection;
				for (const subSectionId of subSections) {
					await SubSection.findByIdAndDelete(subSectionId);
				}
				await Section.findByIdAndDelete(sectionId);
			}
		}

		// Delete the course itself
		await Course.findByIdAndDelete(courseId);

		// Respond with success message
		return res.status(200).json({
			success: true,
			message: "Course Deleted Successfully",
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({
			success: false,
			message: "Failed to delete course",
			error: error.message,
		});
	}
};

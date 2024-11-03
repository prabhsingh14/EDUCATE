const Course = require("../models/Course");
const Category = require("../models/Category");
const Section = require("../models/Section");
const SubSection = require("../models/SubSection");
const User = require("../models/User");
const { uploadImageToCloudinary } = require("../utils/fileUploader");

exports.createCourse = async (req, res) => {
	try {
		const userId = req.user.id;

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
		const tag = JSON.parse(_tag); // Convert the stringified tag to an array
		const instructions = JSON.parse(_instructions);

		if (
			!courseName ||
			!courseDescription ||
			!whatYouWillLearn ||
			!price ||
			!tag ||
			!thumbnail ||
			!category
		) {
			return res.status(400).json({
				success: false,
				message: "All Fields are Mandatory",
			});
		}

		if (!status || status === undefined) {
			status = "Draft";
		}
		
		const instructorDetails = await User.findById(userId, {
			accountType: "Instructor", // course can only be created by an instructor
		});

		if (!instructorDetails) {
			return res.status(404).json({
				success: false,
				message: "Instructor Details Not Found",
			});
		}

		const categoryDetails = await Category.findById(category);
		if (!categoryDetails) {
			return res.status(404).json({
				success: false,
				message: "Category Details Not Found",
			});
		}

		const thumbnailImage = await uploadImageToCloudinary(
			thumbnail,
			process.env.FOLDER_NAME
		);

		const newCourse = await Course.create({
			courseName,
			courseDescription,
			instructor: instructorDetails._id,
			whatYouWillLearn: whatYouWillLearn,
			price,
			tag: tag,
			category: categoryDetails._id,
			thumbnail: thumbnailImage.secure_url,
			status: status,
			instructions,
		});

		// Add the new course to the User Schema of the Instructor
		await User.findByIdAndUpdate(
			{
				_id: instructorDetails._id,
			},
			{
				$push: {
					courses: newCourse._id,
				},
			},
			{ new: true }
		);

		// Add the new course to the Categories
		await Category.findByIdAndUpdate(
			{ _id: category },
			{
				$push: {
					course: newCourse._id,
				},
			},
			{ new: true }
		);
		
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

exports.editCourse = async (req, res) => {
	try{
		const {courseId} = req.body;
		const updates = req.body;
		const course = await Course.findById(courseId);

		if(!course){
			return res.status(404).json({
				success:false,
				message:`Could not find the course with ${courseId}`,
			});
		}

		// if thumbnail is found, update it
		if(req.files){
			const thumbnail = req.files.thumbnailImage;
			const thumbnailImage = await uploadImageToCloudinary(
				thumbnail,
				process.env.FOLDER_NAME
			);
			course.thumbnail = thumbnailImage.secure_url; // secure_url is found in the cloudinary response
		}

		// update the files that are there in the request body
		for(const key in updates){
			if(updates.hasOwnProperty(key)){
				if(key === "tag" || key === "instructions" || key === "category"){
					course[key] = JSON.parse(updates[key]); // we need to parse the stringified JSON
				}
				else{
					course[key] = updates[key];
				}
			}
		}

		await course.save();

		const updatedCourse = await Course.findOne({
			_id: courseId,
		})
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
		}).exec();

		res.json({
			success: true,
			message: "Course Updated Successfully",
			data: updatedCourse,
		})
	} catch(error){
		console.error(error);
		res.status(500).json({
			success: false,
			message: "Failed to edit course",
			error: error.message,
		});
	}
};

exports.getAllCourses = async (req, res) => {
	try {
		const allCourses = await Course.find(
			{},
			{
				courseName: true,
				price: true,
				thumbnail: true,
				instructor: true,
				ratingAndReviews: true,
				studentsEnrolled: true,
			}
		)
			.populate("instructor")
			.exec();
		return res.status(200).json({
			success: true,
			data: allCourses,
		});
	} catch (error) {
		console.log(error);
		return res.status(404).json({
			success: false,
			message: `Can't Fetch Course Data`,
			error: error.message,
		});
	}
};

exports.getCourseDetails = async (req, res) => {
    try {
        const {courseId} = req.body;
		const courseDetails = await Course.find(
                                        {_id:courseId})
                                        .populate(
                                            {
                                                path:"instructor",
                                                populate:{
                                                    path:"additionalDetails",
                                                },
                                            }
                                        )
                                        .populate("category")
                                        //.populate("ratingAndreviews")
                                        .populate({
                                            path:"courseContent",
                                            populate:{
                                                path:"subSection",
                                            },
                                        })
                                        .exec();

                //validation
                if(!courseDetails) {
                    return res.status(400).json({
                        success:false,
                        message:`Could not find the course with ${courseId}`,
                    });
                }
                //return response
                return res.status(200).json({
                    success:true,
                    message:"Course Details fetched successfully",
                    data:courseDetails,
                })

    }
    catch(error) {
        console.log(error);
        return res.status(500).json({
            success:false,
            message:error.message,
        });
    }
};

exports.deleteCourse = async (req, res) => {
	try{
		const {courseId} = req.body;
		const course = await Course.findById(courseId);

		if(!course){
			return res.status(404).json({
				success:false,
				message:`Could not find the course with ${courseId}`,
			});
		}

		// Unenroll the students from the course
		const studentsEnrolled = course.studentsEnrolled;
		for(const studentId of studentsEnrolled){
			await User.findByIdAndUpdate(studentId, {
				$pull:{courses: courseId},
			});
		}

		// Delete sections and subsections
		const courseSections = await course.courseContent;
		for(const sectionId of courseSections){
			const section = await Section.findById(sectionId);
			if(section){
				const subSections = section.subSection;
				for(const subSectionId of subSections){
					await SubSection.findByIdAndDelete(subSectionId);
				}
				await Section.findByIdAndDelete(sectionId);
			}
		}

		await Course.findByIdAndDelete(courseId);

		return res.status(200).json({
			success:true,
			message:"Course Deleted Successfully",
		});
	} catch(error){
		console.error(error);
		res.status(500).json({
			success: false,
			message: "Failed to delete course",
			error: error.message,
		});
	}
};

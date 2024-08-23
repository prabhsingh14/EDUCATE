const mongoose = require("mongoose");
const Profile = require("../models/Profile");
const CourseProgress = require("../models/CourseProgress");
const Course = require("../models/Course");
const User = require("../models/User");
const { uploadImageToCloudinary } = require("../utils/fileUploader");
const {convertSecondsToDuration} = require("../utils/secToDuration");

// Controller for updating user profile
exports.updateProfile = async (req, res) => {
    try {
        // Destructure profile fields from the request body with default empty strings
        const { 
            firstName = "",
            lastName = "",
            dateOfBirth = "", 
            about = "", 
            contactNumber = "",
            gender = "",
        } = req.body;
        
        // Get the user ID from the authenticated user's request
        const id = req.user.id;

        // Retrieve the user details based on the ID
        const userDetails = await User.findById(id);

        // Retrieve the associated profile based on the user's additionalDetails field
        const profile = await Profile.findById(userDetails.additionalDetails);

        // Update the user's first and last name
        const user = await User.findByIdAndUpdate(id, {
            firstName,
            lastName,
        }, { new: true });

        // Update the profile fields with the new data from the request
        profile.dateOfBirth = dateOfBirth;
        profile.about = about;
        profile.contactNumber = contactNumber;
        profile.gender = gender;

        // Save the updated profile information to the database
        await profile.save();

        // Retrieve the updated user details including the populated profile data
        const updatedUserDetails = await User.findById(id)
            .populate("additionalDetails") // Populate the additionalDetails field for complete user info
            .exec();

        // Send a success response with the updated user details
        return res.json({
            success: true,
            message: "Profile updated successfully",
            updatedUserDetails,
        });
    } catch (error) {
        // Log any errors to the console for debugging
        console.log(error);
        
        // Send an error response if something goes wrong during the update
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

// Controller for deleting a user account
exports.deleteAccount = async (req, res) => {
    try {
        // Get the user ID from the authenticated user's request
        const id = req.user.id;

        // Find the user by ID
        const user = await User.findById(id);
        if (!user) {
            // Return a 404 response if the user is not found
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Delete the associated profile using the additionalDetails reference
        await Profile.findByIdAndDelete(user.additionalDetails);
        
        // Unenroll the user from all courses they are enrolled in
        for (const courseId of user.courses) {
            await Course.findByIdAndUpdate(
                courseId,
                { $pull: { studentsEnrolled: id } }, // Remove the user ID from the studentsEnrolled array
                { new: true }
            );
        }

        // Delete the user document from the database
        await User.findByIdAndDelete(id);

        // Send a success response indicating the user was deleted
        res.status(200).json({
            success: true,
            message: "User deleted successfully",
        });

        // Delete any course progress records associated with the user
        await CourseProgress.deleteMany({ userId: id });
    } catch (error) {
        // Log any errors to the console for debugging
        console.log(error);

        // Send an error response if something goes wrong during account deletion
        res.status(500).json({ 
            success: false, 
            message: "Error deleting user", 
        });
    }
};

// Controller for fetching all details of the authenticated user
exports.getAllUserDetails = async (req, res) => {
    try {
        // Get the authenticated user's ID from the request
        const id = req.user.id;
        
        // Retrieve the user details based on the ID, and populate the additionalDetails field
        const userDetails = await User.findById(id)
            .populate("additionalDetails") // Populate the additionalDetails field for complete user info
            .exec(); // Execute the query

        // Send a success response with the fetched user details
        res.status(200).json({
            success: true,
            message: "User Data fetched successfully",
            data: userDetails, // Return the user details as the response data
        });
    } catch (error) {
        // If an error occurs, send a 500 response with the error message
        return res.status(500).json({
            success: false,
            message: error.message, // Provide the error message to help with debugging
        });
    }
};

// Controller for updating the user's profile picture
exports.updateProfilePicture = async (req, res) => {
    try {
        // Retrieve the profile picture from the request files
        const profilePicture = req.files.profilePicture;
        const userId = req.user.id;

        // Upload the profile picture to Cloudinary and get the image details
        const image = await uploadImageToCloudinary(
            profilePicture,
            process.env.FOLDER_NAME,
            1000, // Image width
            1000  // Image height
        );

        // Update the user's profile picture URL in the database
        const updatedProfile = await User.findByIdAndUpdate(
            userId,
            { image: image.secure_url }, // Set the new profile picture URL
            { new: true }
        );

        // Send a success response with the updated user profile
        res.send({
            success: true,
            message: `Profile photo updated successfully`,
            data: updatedProfile,
        });
    } catch (error) {
        // Send an error response if something goes wrong during the profile picture update
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Controller for the Student Dashboard
exports.studentDashboard = async (req, res) => {
    try {
        // Retrieve the user ID from the request object
        const userId = req.user.id;

        // Fetch user details, including enrolled courses and their content with sub-sections
        let userDetails = await User.findOne({ _id: userId })
            .populate({
                path: "courses",
                populate: {
                    path: "courseContent",
                    populate: {
                        path: "subSection",
                    },
                },
            })
            .exec();

        // Convert the mongoose object to a plain JavaScript object
        userDetails = userDetails.toObject();
        
        // Iterate through each course to calculate the total duration and progress percentage
        for (let course = 0; course < userDetails.courses.length; course++) {
            let totalDurationInSeconds = 0;
            let subSectionLength = 0; // Reset the subSectionLength for each course

            // Iterate through each section of the course to calculate the total duration and sub-section count
            for (let section = 0; section < userDetails.courses[course].courseContent.length; section++) {
                totalDurationInSeconds += userDetails.courses[course].courseContent[section].subSection.reduce(
                    (acc, curr) => acc + parseInt(curr.duration), 
                    0
                );

                // Convert total duration from seconds to a more readable format
                userDetails.courses[course].totalDuration = convertSecondsToDuration(totalDurationInSeconds);

                // Increment subSectionLength to keep track of the total number of sub-sections
                subSectionLength += userDetails.courses[course].courseContent[section].subSection.length;
            }

            // Fetch the course progress for the user from the CourseProgress model
            let courseProgressCount = await CourseProgress.findOne({
                userId: userId,
                courseId: userDetails.courses[course]._id,
            });

            // Get the number of completed videos in the course
            courseProgressCount = courseProgressCount?.completedVideos.length;

            // Calculate the progress percentage based on completed videos and total sub-sections
            if (subSectionLength === 0) {
                userDetails.courses[course].progressPercentage = 100;
            } else {
                const multiplier = Math.pow(10, 2); // Ensure two decimal places for progress percentage
                userDetails.courses[course].progressPercentage =
                    Math.round((courseProgressCount / subSectionLength) * 100 * multiplier) / multiplier;
            }
        }

        // Check if user details were found
        if (!userDetails) {
            return res.status(400).json({
                success: false,
                message: `Could not find user with id: ${userDetails}`,
            });
        }

        // Return the user's course data as a JSON response
        return res.status(200).json({
            success: true,
            data: userDetails.courses,
        });
    } catch (error) {
        // Handle any errors that occur during the process
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Controller for the Instructor Dashboard
exports.instructorDashboard = async (req, res) => {
    try {
        // Fetch all courses created by the instructor using their user ID
        const courseDetails = await Course.find({ instructor: req.user.id });

        // Map through the fetched courses to calculate stats for each course
        const courseData = courseDetails.map((course) => {
            const totalStudentsEnrolled = course.studentsEnrolled.length; // Get the number of students enrolled
            const totalAmountEarned = totalStudentsEnrolled * course.price; // Calculate total earnings based on enrollments

            // Create an object containing the course stats to return
            const courseStats = {
                _id: course._id,
                courseName: course.courseName,
                courseDescription: course.courseDescription,
                totalStudentsEnrolled,
                totalAmountEarned,
                price: course.price,
            };

            return courseStats;
        });

        // Return the instructor's course data as a JSON response
        res.status(200).json({
            success: true,
            courses: courseData,
        });
    } catch (error) {
        // Handle any errors that occur during the process
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
};
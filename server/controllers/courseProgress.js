const mongoose = require("mongoose");
const Section = require("../models/Section");
const SubSection = require("../models/SubSection");
const CourseProgress = require("../models/CourseProgress");
const Course = require("../models/Course");

exports.updateCourseProgress = async(req, res) => {
    const {courseId, subsectionId} = req.body;
    const userId = req.user.id;

    try{
        // Check if subsection is valid
        const subsection = await SubSection.findById(subsectionId);
        if(!subsection){
            return res.status(404).json({
                error: "Invalid subsection"
            })
        }

        let courseProgress = await CourseProgress.findOne({
            courseID: courseId,
            userId: userId,
        })

        if(!courseProgress){
            return res.status(404).json({
                success: false,
                message: "Course progress does not exist",
            })
        } else{
            if(courseProgress.completedVideos.includes(subsectionId)){
                return res.status(400).json({
                    error: "Subsection already completed",
                })
            }

            courseProgress.completedVideos.push(subsectionId);
        }

        await courseProgress.save();

        return res.status(200).json({
            message: "Course progress updated",
        })
    } catch(error){
        return res.status(500).json({
            error: "Internal server error",
        })
    }
};

exports.getProgressPercentage = async(req, res) => {
    const {courseId} = req.body;
    const userId = req.user.id;

    try{
        const course = await Course.findById(courseId);
        if(!course){
            return res.status(404).json({
                error: "Course not found",
            })
        }

        let courseProgress = await CourseProgress.findOne({
            courseID: courseId,
            userId: userId,
        })
        .populate({
            path: "courseID",
            populate: {
                path: "courseContent",
            },
        })
        .exec();

        if(!courseProgress){
            return res.status(404).json({
                error: "Course progress not found",
            })
        }

        let lectures = 0;
        courseProgress.courseID.courseContent.forEach((section) => {
            lectures += section.subsections.length || 0;
        })

        let progressPercentage = (courseProgress.completedVideos.length / lectures) * 100;

        const multiplier = Math.pow(10, 2);
        progressPercentage = Math.round(progressPercentage * multiplier) / multiplier;

        return res.status(200).json({
            data: progressPercentage,
            message: "Success",
        })
    } catch(error){
        console.error(error);
        return res.status(500).json({
            error: "Internal server error",
        })
    }
};
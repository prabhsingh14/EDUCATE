const RatingAndReview = require("../models/RatingAndReview");
const Course = require("../models/Course");
const mongoose = require("mongoose");

exports.createRating = async (req, res) => {
    try{
        const userId = req.user.id;
        const {rating, review, courseId} = req.body;
        
        // Check if the user is enrolled in the course
        const courseDetails = await Course.findOne(
                                    {_id:courseId,
                                    studentsEnrolled: {$elemMatch: {$eq: userId} },
                                });

        if(!courseDetails) {
            return res.status(404).json({
                success:false,
                message:'Student is not enrolled in the course',
            });
        }
        
        //check if user already reviewed the course
        const alreadyReviewed = await RatingAndReview.findOne({
            user:userId,
            course:courseId,
        });

        if(alreadyReviewed) {
            return res.status(403).json({
                success:false,
                message:'Course is already reviewed by the user',
            });
        }

        //create rating and review
        const ratingReview = await RatingAndReview.create({
            rating, review, 
            course:courseId,
            user:userId,
        });

        // Add this rating and review to the given course
        await Course.findByIdAndUpdate({_id:courseId},
                                    {
                                        $push: {
                                            ratingAndReviews: ratingReview,
                                        }
                                    },
                                    {new: true});
        
        await courseDetails.save();


        return res.status(200).json({
            success:true,
            message:"Rating and Review created successfully",
            ratingReview,
        })
    } catch(error) {
        console.error(error);
        return res.status(500).json({
            success:false,
            message: "Internal server error",
            error:error.message,
        })
    }
}

exports.getAverageRating = async (req, res) => {
    try {
        const courseId = req.body.courseId;

        // average rating using MongoDB aggregation pipeline
        const result = await RatingAndReview.aggregate([
            {
                $match:{
                    course: new mongoose.Types.ObjectId(courseId),
                },
            },
            {
                $group:{
                    _id:null,
                    averageRating: { $avg: "$rating"},
                }
            }
        ])

        if(result.length > 0) {
            return res.status(200).json({
                success:true,
                averageRating: result[0].averageRating,
            })
        }
        
        //if no rating/Review exist
        return res.status(200).json({
            success:true,
            message:'Average Rating is 0, no ratings given till now',
            averageRating:0,
        })
    }catch(error) {
        console.error(error);
        return res.status(500).json({
            success:false,
            message: "Failed to get the rating for the course",
            error:error.message,
        })
    }
}

exports.getAllRating = async (req, res) => {
    try{
            const allReviews = await RatingAndReview.find({})
                                    .sort({rating: "desc"})
                                    .populate({
                                        path:"user",
                                        select:"firstName lastName email image", // fields to populate from User model
                                    })
                                    .populate({
                                        path:"course",
                                        select: "courseName", // fields to populate from Course model
                                    })
                                    .exec();
            return res.status(200).json({
                success:true,
                message:"All reviews fetched successfully",
                data:allReviews,
            });
    } catch(error) {
        console.error(error);
        return res.status(500).json({
            success:false,
            message: "Failed to retrieve the rating and review for the course",
            error: error.message,
        })
    } 
}
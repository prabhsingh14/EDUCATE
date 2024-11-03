const {instance} = require("../config/razorpay");
const Course = require("../models/Course");
const User = require("../models/User");
const crypto = require("crypto");
const mailSender = require("../utils/mailSender");
const {courseEnrollmentEmail} = require("../mail/templates/courseEnrollmentEmail");
const mongoose = require("mongoose");
const {paymentSuccessEmail} = require("../mail/templates/paymentSuccessEmail");
const CourseProgress = require("../models/CourseProgress");

exports.capturePayment = async (req, res) => {
    // Extract courses array from request body and user ID from authenticated user
    const { courses } = req.body;
    const userId = req.user.id;

    if (courses.length === 0) {
        return res.json({
            success: false,
            message: 'Please provide valid course ID',
        });
    }

    let totalAmount = 0;

    // Iterate over each course ID provided in the request
    for (const courseId of courses) {
        try {
            // Find the course by its ID in the database
            let course = await Course.findById(courseId);

            // If the course is not found, return a 404 response
            if (!course) {
                return res.status(404).json({
                    success: false,
                    message: "Course not found",
                });
            }

            // Convert the userId to a MongoDB ObjectId
            const uId = new mongoose.Types.ObjectId(userId);

            // Check if the user is already enrolled in the course
            if (course.studentsEnrolled.includes(uId)) {
                return res.status(200).json({
                    success: false,
                    message: "Student is already enrolled",
                });
            }

            // Add the course price to the total amount to be paid
            totalAmount += course.price;

        } catch (error) {
            console.log(error);
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    // Define payment options for the payment gateway
    const options = {
        amount: totalAmount * 100, 
        currency: "INR",
        receipt: Math.random(Date.now()).toString(), 
    };

    try {
        // Create a new payment order using the payment gateway instance
        const paymentResponse = await instance.orders.create(options);

        // Return the payment order details in the response
        return res.status(200).json({
            success: true,
            data: paymentResponse,
        });
    } catch (error) {
        console.log(error);
        res.json({
            success: false,
            message: "Could not initiate order",
        });
    }
};

exports.verifyPayment = async (req, res) => {
    // Extract the payment details from the request body
    const razorpay_order_id = req.body.razorpay_order_id;
    const razorpay_payment_id = req.body.razorpay_payment_id;
    const razorpay_signature = req.body.razorpay_signature;
    const userId = req.user.id;
    const courses = req.body.courses;

    if(!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !courses || !userId) {
        return res.status(400).json({
            success: false,
            message: "Invalid request",
        });
    }

    let body = raxorpay_order_id + "|" + razorpay_payment_id;

    // Create a hash of the body string using the RAZORPAY_SECRET key
    const expectedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_SECRET).update(body.toString()).digest("hex");   

    if(expectedSignature === razorpay_signature) {
        await enrollStudents(coures, userId, res);
        return res.status(200).json({
            success: true,
            message: "Payment verified!",
        });
    }
    
    return res.status(400).json({
        success: false,
        message: "Payment verification failed",
    });
};

exports.sendPaymentSuccessEmail = async (req, res) => {
    const {orderId, paymentId, amount} = req.body;
    const userId = req.user.id;

    if(!orderId || !paymentId || !amount || !userId) {
        return res.status(400).json({
            success: false,
            message: "Invalid request",
        });
    }

    try{
        const enrolledStudent = await User.findById(userId);

        await mailSender(
            enrolledStudent.email,
            'Payment Successful',
            paymentSuccessEmail(`{$enrolledStudent.firstName} ${enrolledStudent.lastName}`, amount/100, orderId, paymentId)
        )
    } catch(error){
        return res.status(500).json({
            success: false,
            message: "Could not send email",
        });
    }
};

// enroll student in the course
const enrollStudents = async (courses, userId, res) => {
    if(!courses || !userId) {
        return res.status(400).json({
            success: false,
            message: "Invalid request",
        });
    }

    // iterate over each course ID provided in the request
    for(const courseId of courses){
        try{
            const enrolledCourse = await Course.findOneAndUpdate(
                {_id: courseId},
                {$push: {studentsEnrolled: userId}},
                {new: true}
            );

            if(!enrolledCourse){
                return res.status(404).json({
                    success: false,
                    message: "Course not found",
                });
            }
            
            // create a new course progress document for the student
            const CourseProgress = await CourseProgress.create({
                courseID: courseId,
                userId: userId,
                completedVideos: [],
            });

            // update the user document with the enrolled course and course progress
            const enrolledStudent = await User.findByIdAndUpdate(
                userId,
                {
                    $push: {
                        courses: courseId,
                        courseProgress: courseProgress._id,
                    },
                },
                {new: true}
            )

            // email notification
            await mailSender(
                enrolledStudent.email,
                'Successfully Enrolled into ${enrolledCourse.courseName}',
                courseEnrollmentEmail(enrolledCourse.courseName, `${enrolledStudent.firstName} ${enrolledStudent.lastName}`)
            );
        } catch(error){
            console.log(error);
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
};
const express = require("express");
const router = express.Router();

const {
  createCourse,
  getAllCourses,
  getCourseDetails,
  editCourse,
  deleteCourse,
} = require("../controllers/Course")

const {
  showAllCategories,
  createCategory,
  categoryPageDetails,
} = require("../controllers/Category")

const {
  createSection,
  updateSection,
  deleteSection,
} = require("../controllers/Section")

const {
  createSubSection,
  updateSubSection,
  deleteSubSection,
} = require("../controllers/Subsection")

const {
  createRating,
  getAverageRating,
  getAllRating,
} = require("../controllers/RatingAndReview")

const {
  updateCourseProgress,
  getCoursePercentage,
} = require("../controllers/courseProgress")

const { auth, isInstructor, isStudent, isAdmin } = require("../middlewares/auth")

// Routes that can only be accessed by instructors
router.post("/createCourse", auth, isInstructor, createCourse)
router.post("/editCourse", auth, isInstructor, editCourse)
router.post("/addSection", auth, isInstructor, createSection)
router.post("/updateSection", auth, isInstructor, updateSection)
router.post("/deleteSection", auth, isInstructor, deleteSection)
router.post("/updateSubSection", auth, isInstructor, updateSubSection)
router.post("/deleteSubSection", auth, isInstructor, deleteSubSection)
router.post("/addSubSection", auth, isInstructor, createSubSection)
router.get("/getInstructorCourses", auth, isInstructor, getInstructorCourses)
router.delete("/deleteCourse", auth, isInstructor, deleteCourse)

router.get("/getAllCourses", auth, getAllCourses)
router.post("/getCourseDetails", auth, getCourseDetails)

router.post("/createCategory", auth, isAdmin, createCategory) // Only Admin can create a category

router.get("/showAllCategories", showAllCategories)
router.post("/getCategoryPageDetails", categoryPageDetails)

router.post("/updateCourseProgress", auth, isStudent, updateCourseProgress)

router.post("/createRating", auth, isStudent, createRating) // Only students can rate a course
router.get("/getAverageRating", getAverageRating)
router.get("/getReviews", getAllRating)

module.exports = router
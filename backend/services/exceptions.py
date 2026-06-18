"""EduTest Pro — Domain exceptions."""


class EduTestError(Exception):
    code = "edutest_error"

    def __init__(self, message="", context=None):
        self.message = message or self.code
        self.context = context or {}
        super().__init__(self.message)

    def to_dict(self):
        return {"error": self.code, "message": self.message, "context": self.context}


class CrossTenantAccessError(EduTestError):
    code = "cross_tenant_access"


class UnauthorizedAttemptAccessError(EduTestError):
    code = "unauthorized_attempt_access"


class ExamNotPublishedError(EduTestError):
    code = "exam_not_published"


class ExamHasNoQuestionsError(EduTestError):
    code = "exam_has_no_questions"


class ExamTimeExpiredError(EduTestError):
    code = "exam_time_expired"


class AttemptNotFoundError(EduTestError):
    code = "attempt_not_found"


class AttemptNotInProgressError(EduTestError):
    code = "attempt_not_in_progress"


class AttemptAlreadyCompletedError(EduTestError):
    code = "attempt_already_completed"


class InvalidQuestionForAttemptError(EduTestError):
    code = "invalid_question_for_attempt"


class InvalidQuestionError(EduTestError):
    code = "invalid_question"


class AnswerAlreadyFinalizedError(EduTestError):
    code = "answer_already_finalized"


class ImportValidationError(EduTestError):
    code = "import_validation_error"

    def __init__(self, message="", errors=None, context=None):
        super().__init__(message, context)
        self.errors = errors or []


class ImportFileFormatError(EduTestError):
    code = "import_file_format_error"


class ImportFileTooLargeError(EduTestError):
    code = "import_file_too_large"

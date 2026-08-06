ALLOWED_EXTENSIONS = {"pdf", "docx", "txt"}
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
}


def get_file_extension(filename: str) -> str:
    """Extract and return the lowercase file extension."""
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def is_allowed_file(filename: str) -> bool:
    """Check whether the uploaded file has an allowed extension."""
    return get_file_extension(filename) in ALLOWED_EXTENSIONS


def count_words(text: str) -> int:
    """Return the number of whitespace-separated words in a string."""
    return len(text.split())

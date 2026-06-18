"""
Cookie-to-header middleware.
Reads the httpOnly access_token cookie and sets it as the Authorization header
so that SimpleJWT's JWTAuthentication can process it transparently.
"""


class CookieAuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header:
            cookie_token = request.COOKIES.get("access_token")
            if cookie_token:
                request.META["HTTP_AUTHORIZATION"] = f"Bearer {cookie_token}"
        return self.get_response(request)
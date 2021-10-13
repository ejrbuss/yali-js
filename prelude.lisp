(def first (fn (xs)
	((. xs first))))

(def rest (fn (xs)
	((. xs rest))))

(def defmacro (macro (signature ... body)
	(let
		name (first signature)
		params (rest signature)
			`(def ,name (macro ,params ,,, body)))))

(def defn (macro (signature ... body)
	(let
		name (first signature)
		params (rest signature)
			`(def ,name (fn ,params ,,, body)))))

(defn (cons x xs)
	(let xs (or xs [])
		((. xs unshift) x)))

(defn (zip ... xs)
	(zip-with List ... xs))

(defmacro (\ ... body)
	`(fn (_) ,,, body))

(defn (compose f g)
	(\ (g (f _))))

(def second (compose rest first))

(def last (\ ((. _ last))))

(def count (\ (. _ size)))

(def not (\ (if _ false true)))

(defn (/= ... args)
	(not (= ... args)))

(def empty? (\ (= 0 (count _))))

(def square (\ ( * _ _)))

(def abs (\ (cond
	(< _ 0) (- _)
	(> _ 0) _
	default _)))

(defn (average ... xs)
	(/ (+ ... xs) (count xs)))

(def inc (\ (+ _ 1)))

(def dec (\ (- _ 1)))

;; Lecture 1A: Overview and Introduction to Lisp
(defn (sqrt  n)

	(defn (try-guess guess)
		(if (good-enough? guess)
			guess
			(try-guess (improve guess))))

	(defn (improve guess)
		(average guess (/ n guess)))

	(defn (good-enough? guess)
		(< (abs (- (square guess) n))
			0.0001))

	(try-guess 1))


;; Lecture 1B: Procedures and Processes; Substitution Model
(defn (sqs x y)
	(+ (square x) (square y)))

;; (log (sqs 3 4)) ;; 25

(defn (polynomial-fib n)
	(if (< n 2)
		n
		(+ (fib1 (- n 1))
			(fib1 (- n 2)))))

(defn (fib n)
	(defn (inner c fc fc-1)
		(if (= c n)
			fc
			(inner (inc c) (+ fc fc-1) fc)))
	(if (< n 2)
		n
		(inner 1 1 0)))

;; Lecture 2A: Higher-order Procedures

(defn (sigma term a b)
	(let
		next (or next inc)
		(if (> a b)
			0
			(+ (term a) (sigma term (next a) b next)))))

(defmacro (loop init condition ... body)
	(let
		it (first init)
		next `(\ (cons ,it (loop (,it _) ,condition ,,, body)))
		body `(do ,,, body)
		`(let
			,it ,(second init)
			(if ,condition
				(,next ,body)
				[]))))

(defn (abs-difference a b)
	(abs (- a b)))

(defn (within-epsilon epsilon a b)
	(< (abs-difference a b) (or epsilon 0.0001)))

(defn (fixed-point f start tolerance)
	(defn (iter old new)
		(if (within-epsilon tolerance old new)
			new
			(iter new (f new))))
	(iter (f start) start))

(defn (sqrt x)
	(fixed-point
		(\ (average _ (/ x _)))
		1))

(defn (sqrt x)
	(fixed-point
		(average-damp
			(\ (/ x _)))
		1))

(defn (average-damp f)
	(\ (average (f _) _)))

(defn (sqrt x)
	(newton (\ (- x (square _))) 1))

(defn (newton f start)
	(let df (numeric-derivative f)
		(fixed-point
			(\ (- _ (/ (f _) (df _))))
			start)))

(defn (numeric-derivative f dx)
	(let dx (or dx 0.00001)
		(fn (x)
			(/ (- (f (+ x dx))
					(f x))
				dx))))

;; Lecture 2B: Compound Data

(defn (gcd a b)
	(if (= b 0)
		a
		(gcd b (mod a b))))

(defn (Ratio n d)
	(let
		c (gcd n d)
		n (/ n c)
		d (/ d c)
		{ :type 'Ratio :n n :d d }))

(defn (Ratio-n r)
	(:n r))

(defn (Ratio-d r)
	(:d r))

(defn (Ratio+ x y)
	(Ratio
		(+ (* (Ratio-n x) (Ratio-d y))
			(* (Ratio-n y) (Ratio-d x)))
		(* (Ratio-d x) (Ratio-d y))))

(defn (Ratio* x y)
	(Ratio
		(* (Ratio-n x) (Ratio-n y))
		(* (Ratio-d x) (Ratio-d y))))

(defn (Vec2 x y)
	{ :type Vec2 :x x :y y })
(def Vec2-x :x)
(def Vec2-y :y)

(defn (Line start end)
	{ :type Line :start start :end end })
(def Line-start :start)
(def Line-end :end)

(def avg average)

(defn (Line-midpoint l)
	(let
		a (Line-start l)
		b (Line-end l)
		(Vec2
			(avg (Vec2-x a) (Vec2-x b))
			(avg (Vec2-y a) (Vec2-y b)))))

(defn (Line-length l)
	(let
		dx (-
			(Vec2-x (Line-end l))
			(Vec2-x (Line-start l)))
		dy (-
			(Vec2-y (Line-end l))
			(Vec2-y (Line-start l)))
		(sqrt (+
			(square dx)
			(square dy)))))

(defn (get object ... args)
	((. object get) ... args))

(defn (set! object ... args)
	((. object set) ... args))

;; Lecture 3A: Henderson Escher Example
(def Nil? (\ (= Nil (type-of _))))

(defn (Vec2+ v1 v2)
	(Vec2
		(+ (Vec2-x v1) (Vec2-x v2))
		(+ (Vec2-y v1) (Vec2-y v2))))

(defn (Vec2- v1 v2)
	(if (Nil? v2)
		(Vec2
			(- (Vec2-x v1))
			(- (Vec2-y v1)))
		(Vec2
			(- (Vec2-x v1) (Vec2-x v2))
			(- (Vec2-y v1) (Vec2-y v2)))))

(defn (Vec2-scale s v)
	(Vec2
		(* s (Vec2-x v))
		(* s (Vec2-y v))))

(defn (nth n xs)
	(xs n))

(defn (Rect o h v)
	{
		:type Rect
		:o o
		:h h
		:v v })

(def Rect-o :o)
(def Rect-h :h)
(def Rect-v :v)

(defn (reload)
	(eval (read-file "prelude.lisp")))

(defn (Rect-map rect)
	(fn (point)
		(let
			o (Rect-o rect)
			h (Rect-h rect)
			v (Rect-v rect)
			x (Vec2-x point)
			y (Vec2-y point)
			(Vec2+
				(Vec2+
					(Vec2-scale x h)
					(Vec2-scale y v))
				o))))

(defn (Picture lines)
	(fn (rect)
		(for-each
			(fn (line)
				(let
					coord-map (Rect-map rect)
					start (coord-map (Line-start line))
					end (coord-map (Line-end line))
					(SVG-draw-line (Line start end))))
		lines)))

(defn (SVG-draw-line line)
	(let
		x1 (Vec2-x (Line-start line))
		y1 (- 100 (Vec2-y (Line-start line)))
		x2 (Vec2-x (Line-end line))
		y2 (- 100 (Vec2-y (Line-end line)))
	(SVG-write
		(Str "  <line x1=\"" x1
			"\" y1=\"" y1
			"\" x2=\"" x2
			"\" y2=\"" y2
			"\" stroke=\"black\" />\n"))))

(def SVG-file "out.svg")

(defn (SVG-clear)
	(write-file SVG-file ""))

(defn (SVG-write text)
	(write-file SVG-file text "as"))

(defn (SVG-draw picture)
	;; clear files
	(SVG-clear)
	;; write header
	(SVG-write "<svg viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\">\n")
	;; draw lines
	(picture (Rect
		(Vec2 0 0)
		(Vec2 100 0)
		(Vec2 0 100)))
	;; write footer
	(SVG-write "</svg>"))

(defn (Picture-beside p1 p2 s)
	(fn (rect)
		(let
			o (Rect-o rect)
			h (Rect-h rect)
			v (Rect-v rect)
			h1 (Vec2-scale s h)
			h2 (Vec2-scale (- 1 s) h)
			(do
				(p1 (Rect o h1 v))
				(p2 (Rect (Vec2+ o h1) h2 v))))))

(defn (Picture-rotate90 p)
	(fn (rect)
		(p (Rect
			(Vec2+ (Rect-o rect) (Rect-h rect))
			(Rect-v rect)
			(Vec2-scale -1 (Rect-h rect))))))

(defn (Picture-right-push p n a)
	(if (= n 0)
		p
		(Picture-beside p (Picture-right-push p (dec n) a) a)))

;; ; Destructuring??
;; (defn (Picture-beside p1 p2 Picture s)
;; 	(fn ((Rect o h v))
;; 		(let
;; 			h1 (* h s)
;; 			h2 (* h (- 1 s))
;; 			(do
;; 				(p1 (Rect o h1 v))
;; 				(p2 (Rect (Vec2+ o h1) h2 v))))))

(def cross (Picture [
	(Line (Vec2 0 1) (Vec2 1 0))
	(Line (Vec2 0 0) (Vec2 1 1))]))

(def box (Picture [
	(Line (Vec2 0.1 0.1) (Vec2 0.1 0.9))
	(Line (Vec2 0.1 0.9) (Vec2 0.9 0.9))
	(Line (Vec2 0.9 0.9) (Vec2 0.9 0.1))
	(Line (Vec2 0.9 0.1) (Vec2 0.1 0.1))]))

(SVG-draw
	(Picture-right-push
		(Picture-beside cross box 0.2)
		3
		0.5))

(defn (repeated f n)
	(\ (reduce (\ (f _)) _ (range n))))

;; Lecture 3B: Symbolic Differentiation; Quotation
(defn (deriv expr var)
	(cond
		(Constant? expr var) 0
		(same-var? expr var) 1
		(Sum? expr)
			(Sum
				(deriv (Sum-left expr) var)
				(deriv (Sum-right expr) var))
		(Product? expr)
			(Sum
				(Product
					(Product-left expr)
					(deriv (Product-right expr) var))
				(Product
					(deriv (Product-left expr) expr)
					(Product-right expr)))))

(defn (Constant? expr var)
	(And
		(atomic? expr)
		(/= expr var)))

(defin (same-var? expr var)
	(And
		(atom? expr)
		(= expr var)))


;; thinking about new forms
(def name value)

(def-interface (Iter-next type))
(def-interface (Iter-count type))

(def-impl (Iter-next YourType) your-next)
(def-impl (Iter-count YourType) your-count)

(def-proc (count iterable)
	(or
		(Iter-count iterable)
		(match (Iter-next iterable)
			nil 0
			[first next-iter] (inc (count next-iter)))))


(def-struct (Vec2 x y))

(def-type (Vec2 ...))

(if test then else)

(do ... body)

(let ... bindings body)

(quote form)

(proc params ... body)

(loop ... recur)

(throw expr)

(try expr (catch e))

(import file prefix)
(import "Vec2")
Vec2
(import "Vec2" gfx::)
gfx::Vec2

(. object field)
(. object (method ... args))

(def-interface (Operator+ a b))

(def-impl (Operator+ Num Nil) (proc (a b) 0))
(def-impl (Operator+ Num Num) (proc (a b) (__builtin__NumAdd a b))

(def-procs
	(+ a) (Operator+ a nil)
	(+ a b) (Operator+ a b)
	(+ a b ... more) (reduce + (Operator+ a b) more))

(loop (i 0)
	(recur (inc i))
